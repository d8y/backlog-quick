import { useState, useCallback, useEffect } from "react"

import { IssueForm, type FormValues } from "~components/IssueForm"
import { ImageEditor } from "~components/ImageEditor"

import "~style.css"

type Mode = "form" | "edit"

interface EditRequest {
  dataUrl: string
  formValues?: FormValues
  timestamp: number
}

function SidePanel() {
  const [mode, setMode] = useState<Mode>("form")
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)
  const [initialFormValues, setInitialFormValues] = useState<Partial<FormValues> | undefined>(undefined)

  // Side Panel が開いていることを background に通知（port で接続維持）
  useEffect(() => {
    const port = chrome.runtime.connect({ name: "sidepanel" })

    // 接続が切れた時（Side Panel が閉じられた時）は background 側で検出
    return () => {
      port.disconnect()
    }
  }, [])

  // Popup からの編集リクエストをチェック
  useEffect(() => {
    const checkEditRequest = async () => {
      const stored = await chrome.storage.local.get("sidePanelEditRequest")
      if (stored.sidePanelEditRequest) {
        const request = stored.sidePanelEditRequest as EditRequest
        // 1分以内のリクエストのみ受け入れる
        if (Date.now() - request.timestamp < 60 * 1000) {
          setScreenshotDataUrl(request.dataUrl)
          if (request.formValues) {
            setInitialFormValues(request.formValues)
          }
          setMode("edit")
        }
        // リクエストを削除
        chrome.storage.local.remove("sidePanelEditRequest")
      }
    }
    checkEditRequest()
  }, [])

  const handleCaptureScreenshot = useCallback(async () => {
    setCapturingScreenshot(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" })
      if (response.success) {
        setScreenshotDataUrl(response.dataUrl)
      } else {
        console.error(response.error || "スクリーンショットの撮影に失敗しました")
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "スクリーンショットの撮影に失敗しました")
    } finally {
      setCapturingScreenshot(false)
    }
  }, [])

  const handleEditScreenshot = useCallback(() => {
    if (screenshotDataUrl) {
      setMode("edit")
    }
  }, [screenshotDataUrl])

  const handleSaveEdit = useCallback((dataUrl: string) => {
    setScreenshotDataUrl(dataUrl)
    setMode("form")
  }, [])

  const handleCancelEdit = useCallback(() => {
    setMode("form")
  }, [])

  const handleSuccess = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.windowId) {
        // Background script 経由で閉じる（Side Panel から直接呼ぶとコンテキストが無効化されるため）
        chrome.runtime.sendMessage({ type: "CLOSE_SIDE_PANEL", windowId: tab.windowId })
      }
    } catch (error) {
      console.error("Failed to close side panel:", error)
    }
  }, [])

  if (mode === "edit" && screenshotDataUrl) {
    return (
      <div className="plasmo-h-screen">
        <ImageEditor
          imageDataUrl={screenshotDataUrl}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      </div>
    )
  }

  return (
    <div className="plasmo-h-screen">
      <IssueForm
        variant="sidepanel"
        screenshotDataUrl={screenshotDataUrl}
        onScreenshotChange={setScreenshotDataUrl}
        onEditScreenshot={handleEditScreenshot}
        onCaptureScreenshot={handleCaptureScreenshot}
        capturingScreenshot={capturingScreenshot}
        initialValues={initialFormValues}
        onSuccess={handleSuccess}
      />
    </div>
  )
}

export default SidePanel
