import { useCallback, useEffect, useRef, useState } from "react"
import * as fabric from "fabric"

import { HistoryManager } from "~lib/history-manager"
import {
  createArrow,
  createRectangle,
  createText,
  exportCanvasToDataUrl,
} from "~lib/annotation-tools"
import type { AnnotationTool } from "~types/editor"

export interface ImageEditorProps {
  imageDataUrl: string
  onSave: (dataUrl: string) => void
  onCancel: () => void
}

export function ImageEditor({ imageDataUrl, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const historyRef = useRef<HistoryManager>(new HistoryManager())
  const isDrawingRef = useRef(false)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const currentShapeRef = useRef<fabric.FabricObject | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const originalImageRef = useRef<{ width: number; height: number; dataUrl: string } | null>(null)
  const currentScaleRef = useRef<number>(1)
  const isInitializedRef = useRef(false)

  const [activeTool, setActiveTool] = useState<AnnotationTool>("select")
  const [isDirty, setIsDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // コンテナサイズに合わせてキャンバスをリサイズ
  const resizeCanvas = useCallback(() => {
    const canvas = fabricRef.current
    const container = containerRef.current
    const originalImage = originalImageRef.current

    // 初期化が完了していない場合はスキップ
    if (!canvas || !container || !originalImage || !isInitializedRef.current) return

    const maxWidth = container.clientWidth - 20
    const maxHeight = container.clientHeight - 20

    // コンテナサイズが小さすぎる場合はスキップ
    if (maxWidth < 100 || maxHeight < 100) return

    const newScaleX = maxWidth / originalImage.width
    const newScaleY = maxHeight / originalImage.height
    // コンテナに収まる最大サイズに拡大（元サイズより大きくてもOK）
    const newScale = Math.min(newScaleX, newScaleY)

    // スケールがほぼ同じならスキップ
    const oldScale = currentScaleRef.current
    if (Math.abs(newScale - oldScale) < 0.01) return

    const scaleRatio = newScale / oldScale

    const canvasWidth = originalImage.width * newScale
    const canvasHeight = originalImage.height * newScale

    canvas.setDimensions({ width: canvasWidth, height: canvasHeight })

    // 背景画像をリスケール
    if (canvas.backgroundImage) {
      canvas.backgroundImage.set({
        scaleX: newScale,
        scaleY: newScale,
      })
    }

    // すべてのオブジェクトをリスケール
    canvas.getObjects().forEach((obj) => {
      obj.set({
        left: (obj.left || 0) * scaleRatio,
        top: (obj.top || 0) * scaleRatio,
        scaleX: (obj.scaleX || 1) * scaleRatio,
        scaleY: (obj.scaleY || 1) * scaleRatio,
      })
      obj.setCoords()
    })

    currentScaleRef.current = newScale
    canvas.renderAll()
  }, [])

  // Canvas を初期化
  useEffect(() => {
    if (!imageDataUrl || !canvasRef.current || !containerRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: true,
    })
    fabricRef.current = canvas

    // 背景画像を設定
    fabric.FabricImage.fromURL(imageDataUrl).then((img) => {
      const container = containerRef.current
      if (!container) return

      // オリジナル画像サイズを保存
      originalImageRef.current = {
        width: img.width || 800,
        height: img.height || 600,
        dataUrl: imageDataUrl,
      }

      const maxWidth = container.clientWidth - 20
      const maxHeight = container.clientHeight - 20

      let scale = 1
      if (img.width && img.height) {
        const scaleX = maxWidth / img.width
        const scaleY = maxHeight / img.height
        // コンテナに収まる最大サイズに拡大（元サイズより大きくてもOK）
        scale = Math.min(scaleX, scaleY)
      }

      currentScaleRef.current = scale

      const canvasWidth = (img.width || 800) * scale
      const canvasHeight = (img.height || 600) * scale

      canvas.setDimensions({ width: canvasWidth, height: canvasHeight })

      img.set({
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
        originX: "left",
        originY: "top",
      })
      canvas.backgroundImage = img
      canvas.renderAll()

      // 初期状態を履歴に保存
      historyRef.current.initialize(JSON.stringify(canvas.toJSON()))
      updateHistoryState()

      // 初期化完了フラグを設定
      isInitializedRef.current = true
    })

    return () => {
      isInitializedRef.current = false
      canvas.dispose()
    }
  }, [imageDataUrl])

  // ResizeObserver でコンテナサイズの変更を監視
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [resizeCanvas])

  // 描画イベントハンドラを設定
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (activeTool === "select") return

      const pointer = canvas.getViewportPoint(opt.e)
      isDrawingRef.current = true
      startPointRef.current = { x: pointer.x, y: pointer.y }

      if (activeTool === "text") {
        const text = createText(pointer.x, pointer.y)
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        setActiveTool("select")
        isDrawingRef.current = false
        saveHistory()
      } else if (activeTool === "rectangle") {
        const rect = createRectangle(pointer.x, pointer.y, 0, 0)
        rect.selectable = false
        canvas.add(rect)
        currentShapeRef.current = rect
      } else if (activeTool === "arrow") {
        // 矢印は mouse:up で作成
      }
    }

    const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingRef.current || !startPointRef.current) return

      const pointer = canvas.getViewportPoint(opt.e)

      if (activeTool === "rectangle" && currentShapeRef.current) {
        const rect = currentShapeRef.current as fabric.Rect
        const startX = startPointRef.current.x
        const startY = startPointRef.current.y

        rect.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY),
        })
        canvas.renderAll()
      }
    }

    const handleMouseUp = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingRef.current || !startPointRef.current) return

      const pointer = canvas.getViewportPoint(opt.e)

      if (activeTool === "rectangle" && currentShapeRef.current) {
        currentShapeRef.current.selectable = true
        canvas.setActiveObject(currentShapeRef.current)
        saveHistory()
      } else if (activeTool === "arrow") {
        const arrow = createArrow(
          startPointRef.current.x,
          startPointRef.current.y,
          pointer.x,
          pointer.y
        )
        canvas.add(arrow)
        canvas.setActiveObject(arrow)
        saveHistory()
      }

      isDrawingRef.current = false
      startPointRef.current = null
      currentShapeRef.current = null
      setActiveTool("select")
    }

    canvas.on("mouse:down", handleMouseDown)
    canvas.on("mouse:move", handleMouseMove)
    canvas.on("mouse:up", handleMouseUp)

    // オブジェクト変更時に履歴を保存
    canvas.on("object:modified", () => saveHistory())

    return () => {
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("mouse:move", handleMouseMove)
      canvas.off("mouse:up", handleMouseUp)
      canvas.off("object:modified")
    }
  }, [activeTool])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const canvas = fabricRef.current
      if (!canvas) return

      // テキスト編集中は無視
      const activeObject = canvas.getActiveObject()
      if (activeObject instanceof fabric.IText && activeObject.isEditing) {
        return
      }

      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault()
        handleUndo()
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault()
        handleRedo()
      }
      // Delete / Backspace: 選択オブジェクト削除
      else if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getActiveObject()
        if (active) {
          e.preventDefault()
          canvas.remove(active)
          saveHistory()
        }
      }
      // Escape: 選択解除
      else if (e.key === "Escape") {
        canvas.discardActiveObject()
        canvas.renderAll()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const updateHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo())
    setCanRedo(historyRef.current.canRedo())
  }, [])

  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    historyRef.current.push(JSON.stringify(canvas.toJSON()))
    updateHistoryState()
    setIsDirty(true)
  }, [updateHistoryState])

  const handleUndo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const state = historyRef.current.undo()
    if (state) {
      canvas.loadFromJSON(state).then(() => {
        canvas.renderAll()
        updateHistoryState()
      })
    }
  }, [updateHistoryState])

  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const state = historyRef.current.redo()
    if (state) {
      canvas.loadFromJSON(state).then(() => {
        canvas.renderAll()
        updateHistoryState()
      })
    }
  }, [updateHistoryState])

  const handleSave = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    // 選択を解除して保存
    canvas.discardActiveObject()
    canvas.renderAll()

    const dataUrl = exportCanvasToDataUrl(canvas)
    onSave(dataUrl)
  }, [onSave])

  const handleCancel = useCallback(() => {
    if (isDirty) {
      if (!confirm("変更を破棄しますか？")) {
        return
      }
    }
    onCancel()
  }, [isDirty, onCancel])

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full plasmo-bg-gray-100">
      {/* ヘッダー */}
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-px-3 plasmo-py-2 plasmo-bg-white plasmo-shadow plasmo-shrink-0">
        <h2 className="plasmo-text-base plasmo-font-semibold">
          画像編集
          {isDirty && <span className="plasmo-text-orange-500 plasmo-ml-1">*</span>}
        </h2>
        <div className="plasmo-flex plasmo-gap-2">
          <button
            onClick={handleCancel}
            className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-text-gray-700 plasmo-bg-gray-200 plasmo-rounded hover:plasmo-bg-gray-300"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-text-white plasmo-bg-blue-500 plasmo-rounded hover:plasmo-bg-blue-600"
          >
            保存
          </button>
        </div>
      </div>

      {/* ツールバー */}
      <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-2 plasmo-bg-white plasmo-border-b plasmo-shrink-0">
        <div className="plasmo-flex plasmo-gap-1">
          <ToolButton
            active={activeTool === "select"}
            onClick={() => setActiveTool("select")}
            title="選択 (移動・リサイズ)"
          >
            ↖
          </ToolButton>
          <ToolButton
            active={activeTool === "rectangle"}
            onClick={() => setActiveTool("rectangle")}
            title="四角形"
          >
            □
          </ToolButton>
          <ToolButton
            active={activeTool === "arrow"}
            onClick={() => setActiveTool("arrow")}
            title="矢印"
          >
            →
          </ToolButton>
          <ToolButton
            active={activeTool === "text"}
            onClick={() => setActiveTool("text")}
            title="テキスト"
          >
            T
          </ToolButton>
        </div>

        <div className="plasmo-w-px plasmo-h-5 plasmo-bg-gray-300 plasmo-mx-1" />

        <div className="plasmo-flex plasmo-gap-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="plasmo-px-2 plasmo-py-1 plasmo-text-sm plasmo-rounded plasmo-border plasmo-border-gray-300 hover:plasmo-bg-gray-100 disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed"
            title="元に戻す (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="plasmo-px-2 plasmo-py-1 plasmo-text-sm plasmo-rounded plasmo-border plasmo-border-gray-300 hover:plasmo-bg-gray-100 disabled:plasmo-opacity-40 disabled:plasmo-cursor-not-allowed"
            title="やり直し (Ctrl+Shift+Z)"
          >
            ↪
          </button>
        </div>

        <div className="plasmo-flex-1" />

        <span className="plasmo-text-xs plasmo-text-gray-500 plasmo-hidden sm:plasmo-inline">
          Delete: 削除 / Esc: 選択解除
        </span>
      </div>

      {/* Canvas エリア */}
      <div ref={containerRef} className="plasmo-flex-1 plasmo-overflow-auto plasmo-p-2 plasmo-flex plasmo-items-center plasmo-justify-center">
        <div className="plasmo-shadow-lg plasmo-bg-white">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  )
}

interface ToolButtonProps {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}

function ToolButton({ active, onClick, title, children }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`plasmo-w-8 plasmo-h-8 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-rounded plasmo-text-base plasmo-font-bold plasmo-transition-colors ${
        active
          ? "plasmo-bg-blue-500 plasmo-text-white"
          : "plasmo-bg-gray-100 plasmo-text-gray-700 hover:plasmo-bg-gray-200"
      }`}
    >
      {children}
    </button>
  )
}
