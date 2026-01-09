import { Storage } from "@plasmohq/storage"

export {}

const storage = new Storage({ area: "sync" })

// Side Panel の接続状態を追跡
let sidePanelPort: chrome.runtime.Port | null = null

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    sidePanelPort = port
    chrome.storage.local.set({ sidePanelOpen: true })

    port.onDisconnect.addListener(() => {
      sidePanelPort = null
      chrome.storage.local.remove("sidePanelOpen")
    })
  }
})

// UI モードに応じてアクションボタンの動作を設定
async function updateActionBehavior() {
  const uiMode = await storage.get<string>("uiMode")

  if (uiMode === "sidepanel") {
    // Side Panel モード: ポップアップを無効化し、クリック時にサイドパネルを開く
    await chrome.action.setPopup({ popup: "" })
  } else {
    // Popup モード（デフォルト）: ポップアップを有効化
    await chrome.action.setPopup({ popup: "popup.html" })
  }
}

// Service Worker 起動時に即座に実行
updateActionBehavior()

// 初期化時にも実行
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove("sidePanelOpen")
  updateActionBehavior()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove("sidePanelOpen")
  updateActionBehavior()
})

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    const hasUiModeChange = Object.keys(changes).some(key =>
      key === "uiMode" || key.includes("uiMode")
    )
    if (hasUiModeChange) {
      updateActionBehavior()
    }
  }
})

// アクションボタンクリック時（ポップアップが無効の場合のみ発火）
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId })
    } catch (error) {
      console.error("[Backlog Quick] Failed to open side panel:", error)
    }
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    captureScreenshot()
      .then((dataUrl) => {
        sendResponse({ success: true, dataUrl })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "CLOSE_SIDE_PANEL") {
    chrome.sidePanel.close({ windowId: message.windowId })
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})

async function captureScreenshot(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error("No active tab found")
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  })

  return dataUrl
}
