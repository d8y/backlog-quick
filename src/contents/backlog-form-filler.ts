import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://*.backlog.com/add/*"],
  run_at: "document_idle",
}

function setReactInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype

  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  if (nativeSetter) {
    nativeSetter.call(element, value)
  }
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",")
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png"
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

async function pasteImageToEditor(editor: HTMLElement, dataUrl: string): Promise<void> {
  // Convert data URL to File
  const blob = dataURLtoBlob(dataUrl)
  const file = new File([blob], "screenshot.png", { type: blob.type })

  // Create DataTransfer with the file
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)

  // Focus the editor
  editor.focus()

  // Move cursor to end of content
  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  // Create and dispatch paste event
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer,
  })

  editor.dispatchEvent(pasteEvent)
}

async function selectComboboxOption(labelId: string, optionId: string): Promise<boolean> {
  const combobox = document.querySelector<HTMLButtonElement>(
    `button[role="combobox"][aria-labelledby="${labelId}"]`
  )

  if (!combobox) {
    return false
  }

  // Click to open the dropdown
  combobox.click()
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Get the listbox ID from aria-controls
  const listboxId = combobox.getAttribute("aria-controls")
  if (!listboxId) {
    return false
  }

  // Find the listbox
  const listbox = document.querySelector(`#${listboxId}, [id="${listboxId}"]`)
  if (!listbox) {
    combobox.click()
    return false
  }

  // Find option by direct ID selector
  const targetOption = listbox.querySelector(`#${listboxId}-${optionId}`)

  if (targetOption) {
    (targetOption as HTMLElement).click()
    await new Promise((resolve) => setTimeout(resolve, 200))
    return true
  }

  // Close dropdown if no option found
  combobox.click()
  return false
}

interface FormData {
  summary: string | null
  description: string | null
  issueTypeId: string | null
  priorityId: string | null
  assigneeId: string | null
  screenshotDataUrl: string | null
  timestamp: number
}

async function fillForm(): Promise<void> {
  // Read form data from chrome.storage.local
  const result = await chrome.storage.local.get("backlogQuickFormData")
  const formData: FormData | undefined = result.backlogQuickFormData

  if (!formData) {
    return
  }

  // Clear the stored data immediately
  await chrome.storage.local.remove("backlogQuickFormData")

  // Check if data is recent (within 5 seconds) - ensures it came from extension button
  const MAX_AGE_MS = 5000
  if (Date.now() - formData.timestamp > MAX_AGE_MS) {
    return
  }

  const { summary, description, issueTypeId, priorityId, assigneeId, screenshotDataUrl } = formData

  if (!summary && !description && !issueTypeId && !priorityId && !assigneeId && !screenshotDataUrl) {
    return
  }

  // Wait for form to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Fill summary (title)
  if (summary) {
    const summaryInput = document.querySelector<HTMLInputElement>(
      '#summaryInput, input[name="issue.summary"]'
    )
    if (summaryInput) {
      setReactInputValue(summaryInput, summary)
    }
  }

  // Get description editor reference
  const descEditor = document.querySelector<HTMLDivElement>(
    '#descriptionTextArea, .comment-editor__textarea[contenteditable="true"]'
  )

  // Fill description (ProseMirror rich text editor)
  if (description && descEditor) {
    const lines = description.split('\n')
    const html = lines.map(line => `<p>${line || '<br>'}</p>`).join('')
    descEditor.innerHTML = html
    descEditor.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }

  // Paste screenshot into description editor
  if (screenshotDataUrl && descEditor) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await pasteImageToEditor(descEditor, screenshotDataUrl)
  }

  // Fill issue type
  if (issueTypeId) {
    await selectComboboxOption('issueTypeLabel', issueTypeId)
  }

  // Fill priority
  if (priorityId) {
    await selectComboboxOption('priorityLabel', priorityId)
  }

  // Fill assignee
  if (assigneeId) {
    await selectComboboxOption('assignerLabel', assigneeId)
  }

  // Show notification
  const notification = document.createElement("div")
  notification.textContent = "Backlog Quick: フォームに値を自動入力しました"
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #42CE9F;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
  `

  const style = document.createElement("style")
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = "slideIn 0.3s ease-out reverse"
    setTimeout(() => {
      notification.remove()
      style.remove()
    }, 300)
  }, 3000)
}

// Check if extension context is valid
function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

// Run when the page loads
if (isExtensionContextValid()) {
  fillForm().catch(() => {
    // Silently ignore errors
  })
}
