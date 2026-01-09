import { useState, useCallback, useEffect, useRef } from "react"

import { IssueForm, type FormValues } from "~components/IssueForm"

import "~style.css"

function IndexPopup() {
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)
  const formValuesRef = useRef<FormValues | null>(null)

  // Side Panel が開いている場合は Popup を即座に閉じる
  useEffect(() => {
    const checkSidePanel = async () => {
      const { sidePanelOpen } = await chrome.storage.local.get("sidePanelOpen")
      if (sidePanelOpen) {
        window.close()
      }
    }
    checkSidePanel()
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

  // フォーム値の変更を追跡
  const handleFormChange = useCallback((values: FormValues) => {
    formValuesRef.current = values
  }, [])

  const handleSuccess = useCallback(() => {
    window.close()
  }, [])

  // 編集ボタン: Side Panel を開いて編集モードに切り替え
  const handleEditScreenshot = useCallback(async () => {
    if (!screenshotDataUrl) return

    // スクリーンショット、フォームデータ、編集リクエストをストレージに保存
    await chrome.storage.local.set({
      sidePanelEditRequest: {
        dataUrl: screenshotDataUrl,
        formValues: formValuesRef.current,
        timestamp: Date.now(),
      },
    })

    // Side Panel を直接開く（ユーザージェスチャーのコンテキストで）
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId })
        // Side Panel が開いたら Popup を閉じる
        window.close()
      }
    } catch (error) {
      console.error("Failed to open side panel:", error)
    }
  }, [screenshotDataUrl])

  return (
    <div className="plasmo-w-80 plasmo-h-[500px]">
      <IssueForm
        variant="popup"
        screenshotDataUrl={screenshotDataUrl}
        onScreenshotChange={setScreenshotDataUrl}
        onEditScreenshot={handleEditScreenshot}
        onCaptureScreenshot={handleCaptureScreenshot}
        capturingScreenshot={capturingScreenshot}
        onFormChange={handleFormChange}
        onSuccess={handleSuccess}
      />
    </div>
  )
}

export default IndexPopup
