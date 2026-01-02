import { useState, useEffect, useCallback } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"

import { BacklogAPIClient } from "~lib/backlog-api"
import type {
  BacklogProject,
  BacklogIssueType,
  BacklogPriority,
  BacklogUser,
  CreateIssueParams,
} from "~types"

import "~style.css"

const storage = new Storage({ area: "sync" })

interface Defaults {
  projectId: string
  issueTypeId: string
  priorityId: string
  assigneeId: string
}

type SubmitStatus = "idle" | "submitting" | "success" | "error"

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

function IndexPopup() {
  const [apiKey] = useStorage<string>({ key: "apiKey", instance: storage })
  const [space] = useStorage<string>({ key: "space", instance: storage })
  const [defaults] = useStorage<Defaults>({ key: "defaults", instance: storage })

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState("")
  const [selectedPriorityId, setSelectedPriorityId] = useState("")
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")

  const [projects, setProjects] = useState<BacklogProject[]>([])
  const [issueTypes, setIssueTypes] = useState<BacklogIssueType[]>([])
  const [priorities, setPriorities] = useState<BacklogPriority[]>([])
  const [users, setUsers] = useState<BacklogUser[]>([])

  const [loading, setLoading] = useState(true)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [createdIssueUrl, setCreatedIssueUrl] = useState("")

  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)

  const isConfigured = Boolean(apiKey && space)

  useEffect(() => {
    const init = async () => {
      if (!isConfigured) {
        setLoading(false)
        return
      }

      try {
        const client = new BacklogAPIClient(space, apiKey)
        const [projectList, priorityList] = await Promise.all([
          client.getProjects(),
          client.getPriorities(),
        ])

        setProjects(projectList.filter((p) => !p.archived))
        setPriorities(priorityList)

        if (defaults?.priorityId) {
          setSelectedPriorityId(defaults.priorityId)
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]) {
          const url = tabs[0].url || ""
          setDescription(`URL: ${url}\n\n`)
        }
      } catch (error) {
        console.error("Failed to initialize:", error)
        setErrorMessage(error instanceof Error ? error.message : "初期化に失敗しました")
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [apiKey, space, isConfigured, defaults?.priorityId])

  useEffect(() => {
    if (defaults?.projectId && projects.length > 0) {
      handleProjectChange(defaults.projectId)
    }
  }, [defaults?.projectId, projects.length])

  const handleCaptureScreenshot = useCallback(async () => {
    setCapturingScreenshot(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" })
      if (response.success) {
        setScreenshotDataUrl(response.dataUrl)
      } else {
        setErrorMessage(response.error || "スクリーンショットの撮影に失敗しました")
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "スクリーンショットの撮影に失敗しました")
    } finally {
      setCapturingScreenshot(false)
    }
  }, [])

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      setSelectedProjectId(projectId)
      setSelectedIssueTypeId("")
      setSelectedAssigneeId("")
      setIssueTypes([])
      setUsers([])

      if (!projectId || !apiKey || !space) return

      try {
        const client = new BacklogAPIClient(space, apiKey)
        const [issueTypeList, userList] = await Promise.all([
          client.getIssueTypes(projectId),
          client.getUsers(projectId),
        ])
        setIssueTypes(issueTypeList)
        setUsers(userList)

        if (defaults?.issueTypeId) {
          const found = issueTypeList.find((t) => String(t.id) === defaults.issueTypeId)
          if (found) setSelectedIssueTypeId(defaults.issueTypeId)
        }
        if (defaults?.assigneeId) {
          const found = userList.find((u) => String(u.id) === defaults.assigneeId)
          if (found) setSelectedAssigneeId(defaults.assigneeId)
        }
      } catch (error) {
        console.error("Failed to load project data:", error)
      }
    },
    [apiKey, space, defaults]
  )

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !selectedProjectId || !selectedIssueTypeId || !selectedPriorityId) {
      setErrorMessage("必須項目を入力してください")
      return
    }

    setSubmitStatus("submitting")
    setErrorMessage("")

    try {
      const client = new BacklogAPIClient(space, apiKey)

      let attachmentId: string[] | undefined

      if (screenshotDataUrl) {
        const blob = dataURLtoBlob(screenshotDataUrl)
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
        const attachment = await client.uploadAttachmentFromBlob(blob, `screenshot-${timestamp}.png`)
        attachmentId = [String(attachment.id)]
      }

      const params: CreateIssueParams = {
        projectId: selectedProjectId,
        summary: title.trim(),
        issueTypeId: selectedIssueTypeId,
        priorityId: selectedPriorityId,
        description: description.trim() || undefined,
        assigneeId: selectedAssigneeId || undefined,
        attachmentId,
      }

      const issue = await client.createIssue(params)
      const issueUrl = client.getIssueUrl(issue.issueKey)

      setCreatedIssueUrl(issueUrl)
      setSubmitStatus("success")
    } catch (error) {
      setSubmitStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "課題の作成に失敗しました")
    }
  }, [
    title,
    description,
    selectedProjectId,
    selectedIssueTypeId,
    selectedPriorityId,
    selectedAssigneeId,
    screenshotDataUrl,
    apiKey,
    space,
  ])

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const openBacklogIssuePage = useCallback(async () => {
    const selectedProject = projects.find((p) => String(p.id) === selectedProjectId)
    if (!selectedProject || !space) return

    // Store form data for content script to read (including screenshot)
    await chrome.storage.local.set({
      backlogQuickFormData: {
        summary: title.trim() || null,
        description: description.trim() || null,
        issueTypeId: selectedIssueTypeId || null,
        priorityId: selectedPriorityId || null,
        assigneeId: selectedAssigneeId || null,
        screenshotDataUrl: screenshotDataUrl || null,
      },
    })

    const url = `https://${space}/add/${selectedProject.projectKey}`
    chrome.tabs.create({ url })
  }, [
    projects,
    selectedProjectId,
    space,
    title,
    description,
    selectedIssueTypeId,
    selectedPriorityId,
    selectedAssigneeId,
    screenshotDataUrl,
  ])

  if (loading) {
    return (
      <div className="plasmo-w-80 plasmo-p-4">
        <p className="plasmo-text-center plasmo-text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="plasmo-w-80 plasmo-p-4">
        <p className="plasmo-text-center plasmo-text-gray-600 plasmo-mb-4">
          APIキーとスペースを設定してください
        </p>
        <button
          onClick={openOptions}
          className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-blue-700"
        >
          設定を開く
        </button>
      </div>
    )
  }

  if (submitStatus === "success") {
    return (
      <div className="plasmo-w-80 plasmo-p-4">
        <div className="plasmo-text-center">
          <div className="plasmo-text-green-600 plasmo-text-4xl plasmo-mb-2">&#10003;</div>
          <p className="plasmo-text-lg plasmo-font-medium plasmo-text-gray-800 plasmo-mb-4">
            課題を作成しました
          </p>
          <a
            href={createdIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="plasmo-block plasmo-text-blue-600 hover:plasmo-text-blue-800 plasmo-underline plasmo-mb-4 plasmo-break-all"
          >
            {createdIssueUrl}
          </a>
          <button
            onClick={() => {
              setSubmitStatus("idle")
              setTitle("")
              setCreatedIssueUrl("")
              setScreenshotDataUrl(null)
            }}
            className="plasmo-px-4 plasmo-py-2 plasmo-bg-gray-200 plasmo-text-gray-700 plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-gray-300"
          >
            新しい課題を作成
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plasmo-w-80 plasmo-p-4">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-4">
        <h1 className="plasmo-text-lg plasmo-font-bold plasmo-text-gray-800">Backlog Quick</h1>
        <button
          onClick={openOptions}
          className="plasmo-text-2xl plasmo-text-gray-500 hover:plasmo-text-gray-700"
          title="設定"
        >
          &#9881;
        </button>
      </div>

      <div className="plasmo-space-y-3">
        <div>
          <button
            onClick={handleCaptureScreenshot}
            disabled={capturingScreenshot}
            className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-gray-100 plasmo-text-gray-700 plasmo-rounded-md plasmo-font-medium plasmo-border plasmo-border-gray-300 hover:plasmo-bg-gray-200 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-2"
          >
            <span>&#128247;</span>
            {capturingScreenshot ? "撮影中..." : "スクリーンショット撮影"}
          </button>

          {screenshotDataUrl && (
            <div className="plasmo-mt-2 plasmo-relative">
              <img
                src={screenshotDataUrl}
                alt="Screenshot preview"
                className="plasmo-w-full plasmo-rounded-md plasmo-border plasmo-border-gray-200"
              />
              <button
                onClick={() => setScreenshotDataUrl(null)}
                className="plasmo-absolute plasmo-top-1 plasmo-right-1 plasmo-bg-red-500 plasmo-text-white plasmo-rounded-full plasmo-w-6 plasmo-h-6 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-sm hover:plasmo-bg-red-600"
                title="削除"
              >
                &#10005;
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
            タイトル *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="課題のタイトル"
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
          />
        </div>

        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
            説明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
          />
        </div>

        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
            プロジェクト *
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
          >
            <option value="">選択してください</option>
            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.projectKey} - {project.name}
              </option>
            ))}
          </select>
        </div>

        {issueTypes.length > 0 && (
          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
              課題種別 *
            </label>
            <select
              value={selectedIssueTypeId}
              onChange={(e) => setSelectedIssueTypeId(e.target.value)}
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
            >
              <option value="">選択してください</option>
              {issueTypes.map((type) => (
                <option key={type.id} value={String(type.id)}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
            優先度 *
          </label>
          <select
            value={selectedPriorityId}
            onChange={(e) => setSelectedPriorityId(e.target.value)}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
          >
            <option value="">選択してください</option>
            {priorities.map((priority) => (
              <option key={priority.id} value={String(priority.id)}>
                {priority.name}
              </option>
            ))}
          </select>
        </div>

        {users.length > 0 && (
          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
              担当者
            </label>
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
            >
              <option value="">未設定</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {errorMessage && (
          <p className="plasmo-text-sm plasmo-text-red-600">{errorMessage}</p>
        )}

        <div className="plasmo-space-y-2">
          <button
            onClick={handleSubmit}
            disabled={submitStatus === "submitting"}
            className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-blue-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
          >
            {submitStatus === "submitting" ? "作成中..." : "課題を作成"}
          </button>

          <button
            onClick={openBacklogIssuePage}
            disabled={!selectedProjectId}
            className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-gray-100 plasmo-text-gray-700 plasmo-rounded-md plasmo-font-medium plasmo-border plasmo-border-gray-300 hover:plasmo-bg-gray-200 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
          >
            Backlog画面で作成
          </button>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
