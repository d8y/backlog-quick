import { useState, useEffect, useCallback, useMemo } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from "@headlessui/react"

import { createBacklogAPIClient } from "~lib/backlog-api-factory"
import type {
  BacklogProject,
  BacklogIssueType,
  BacklogPriority,
  BacklogUser,
  CreateIssueParams,
} from "~types"

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

export interface FormValues {
  title: string
  description: string
  projectId: string
  issueTypeId: string
  priorityId: string
  assigneeId: string
}

export interface IssueFormProps {
  variant: "popup" | "sidepanel"
  screenshotDataUrl: string | null
  onScreenshotChange: (dataUrl: string | null) => void
  onEditScreenshot?: () => void
  onCaptureScreenshot: () => Promise<void>
  capturingScreenshot: boolean
  initialValues?: Partial<FormValues>
  onFormChange?: (values: FormValues) => void
  onSuccess?: () => void
}

export function IssueForm({
  variant,
  screenshotDataUrl,
  onScreenshotChange,
  onEditScreenshot,
  onCaptureScreenshot,
  capturingScreenshot,
  initialValues,
  onFormChange,
  onSuccess,
}: IssueFormProps) {
  const [apiKey] = useStorage<string>({ key: "apiKey", instance: storage })
  const [space] = useStorage<string>({ key: "space", instance: storage })
  const [defaults] = useStorage<Defaults>({ key: "defaults", instance: storage })

  const [title, setTitle] = useState(initialValues?.title || "")
  const [description, setDescription] = useState(initialValues?.description || "")
  const [selectedProjectId, setSelectedProjectId] = useState(initialValues?.projectId || "")
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState(initialValues?.issueTypeId || "")
  const [selectedPriorityId, setSelectedPriorityId] = useState(initialValues?.priorityId || "")
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(initialValues?.assigneeId || "")

  const [projects, setProjects] = useState<BacklogProject[]>([])
  const [issueTypes, setIssueTypes] = useState<BacklogIssueType[]>([])
  const [priorities, setPriorities] = useState<BacklogPriority[]>([])
  const [users, setUsers] = useState<BacklogUser[]>([])

  const [loading, setLoading] = useState(true)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [createdIssueUrl, setCreatedIssueUrl] = useState("")

  const [projectQuery, setProjectQuery] = useState("")
  const [issueTypeQuery, setIssueTypeQuery] = useState("")
  const [assigneeQuery, setAssigneeQuery] = useState("")

  const filteredProjects = useMemo(() => {
    if (projectQuery === "") return projects
    const query = projectQuery.toLowerCase()
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.projectKey.toLowerCase().includes(query)
    )
  }, [projects, projectQuery])

  const filteredIssueTypes = useMemo(() => {
    if (issueTypeQuery === "") return issueTypes
    const query = issueTypeQuery.toLowerCase()
    return issueTypes.filter((type) => type.name.toLowerCase().includes(query))
  }, [issueTypes, issueTypeQuery])

  const filteredUsers = useMemo(() => {
    if (assigneeQuery === "") return users
    const query = assigneeQuery.toLowerCase()
    return users.filter((user) => user.name.toLowerCase().includes(query))
  }, [users, assigneeQuery])

  const isConfigured = Boolean(apiKey && space)

  // フォーム値の変更を親に通知
  useEffect(() => {
    if (onFormChange) {
      onFormChange({
        title,
        description,
        projectId: selectedProjectId,
        issueTypeId: selectedIssueTypeId,
        priorityId: selectedPriorityId,
        assigneeId: selectedAssigneeId,
      })
    }
  }, [title, description, selectedProjectId, selectedIssueTypeId, selectedPriorityId, selectedAssigneeId, onFormChange])

  useEffect(() => {
    const init = async () => {
      if (!isConfigured) {
        setLoading(false)
        return
      }

      try {
        const client = createBacklogAPIClient(space, apiKey)
        const [projectList, priorityList] = await Promise.all([
          client.getProjects(),
          client.getPriorities(),
        ])

        setProjects(projectList.filter((p) => !p.archived))
        setPriorities(priorityList)

        // 初期値 > デフォルト値 の優先順位で優先度を設定
        const priorityToSet = initialValues?.priorityId || defaults?.priorityId
        if (priorityToSet) {
          setSelectedPriorityId(priorityToSet)
        }

        // 初期値がない場合のみ URL を設定
        if (!initialValues?.description) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tabs[0]) {
            const url = tabs[0].url || ""
            setDescription(`URL: ${url}\n\n`)
          }
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
    // 初期値 > デフォルト値 の優先順位でプロジェクトを設定
    const projectToLoad = initialValues?.projectId || defaults?.projectId
    if (projectToLoad && projects.length > 0) {
      handleProjectChange(projectToLoad)
    }
  }, [initialValues?.projectId, defaults?.projectId, projects.length])

  const handleProjectChange = useCallback(
    async (projectId: string, preserveSelections = false) => {
      setSelectedProjectId(projectId)
      if (!preserveSelections) {
        setSelectedIssueTypeId("")
        setSelectedAssigneeId("")
      }
      setIssueTypes([])
      setUsers([])

      if (!projectId || !apiKey || !space) return

      try {
        const client = createBacklogAPIClient(space, apiKey)
        const [issueTypeList, userList] = await Promise.all([
          client.getIssueTypes(projectId),
          client.getUsers(projectId),
        ])
        setIssueTypes(issueTypeList)
        setUsers(userList)

        // 初期値 > デフォルト値 の優先順位で復元
        const issueTypeToRestore = initialValues?.issueTypeId || defaults?.issueTypeId
        const assigneeToRestore = initialValues?.assigneeId || defaults?.assigneeId

        if (issueTypeToRestore) {
          const found = issueTypeList.find((t) => String(t.id) === issueTypeToRestore)
          if (found) setSelectedIssueTypeId(issueTypeToRestore)
        }
        if (assigneeToRestore) {
          const found = userList.find((u) => String(u.id) === assigneeToRestore)
          if (found) setSelectedAssigneeId(assigneeToRestore)
        }
      } catch (error) {
        console.error("Failed to load project data:", error)
      }
    },
    [apiKey, space, defaults, initialValues]
  )

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !selectedProjectId || !selectedIssueTypeId || !selectedPriorityId) {
      setErrorMessage("必須項目を入力してください")
      return
    }

    setSubmitStatus("submitting")
    setErrorMessage("")

    try {
      const client = createBacklogAPIClient(space, apiKey)

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
      onSuccess?.()
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
    onSuccess,
  ])

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const openBacklogIssuePage = useCallback(async () => {
    const selectedProject = projects.find((p) => String(p.id) === selectedProjectId)
    if (!selectedProject || !space) return

    await chrome.storage.local.set({
      backlogQuickFormData: {
        summary: title.trim() || null,
        description: description.trim() || null,
        issueTypeId: selectedIssueTypeId || null,
        priorityId: selectedPriorityId || null,
        assigneeId: selectedAssigneeId || null,
        screenshotDataUrl: screenshotDataUrl || null,
        timestamp: Date.now(),
      },
    })

    const url = `https://${space}/add/${selectedProject.projectKey}`
    chrome.tabs.create({ url })
    onSuccess?.()
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
    onSuccess,
  ])

  const resetForm = useCallback(() => {
    setSubmitStatus("idle")
    setTitle("")
    setCreatedIssueUrl("")
    onScreenshotChange(null)
  }, [onScreenshotChange])

  if (loading) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-full">
        <p className="plasmo-text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-h-full plasmo-p-4">
        <p className="plasmo-text-center plasmo-text-gray-600 plasmo-mb-4">
          APIキーとスペースを設定してください
        </p>
        <button
          onClick={openOptions}
          className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-blue-700"
        >
          設定を開く
        </button>
      </div>
    )
  }

  if (submitStatus === "success") {
    return (
      <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-h-full plasmo-p-4">
        <div className="plasmo-text-green-600 plasmo-text-4xl plasmo-mb-2">&#10003;</div>
        <p className="plasmo-text-lg plasmo-font-medium plasmo-text-gray-800 plasmo-mb-4">
          課題を作成しました
        </p>
        <a
          href={createdIssueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="plasmo-block plasmo-text-blue-600 hover:plasmo-text-blue-800 plasmo-underline plasmo-mb-4 plasmo-break-all plasmo-text-center"
        >
          {createdIssueUrl}
        </a>
        <button
          onClick={resetForm}
          className="plasmo-px-4 plasmo-py-2 plasmo-bg-gray-200 plasmo-text-gray-700 plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-gray-300"
        >
          新しい課題を作成
        </button>
      </div>
    )
  }

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-full">
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-4 plasmo-pb-2">
        <h1 className="plasmo-text-lg plasmo-font-bold plasmo-text-gray-800">Backlog Quick</h1>
        <button
          onClick={openOptions}
          className="plasmo-text-2xl plasmo-text-gray-500 hover:plasmo-text-gray-700"
          title="設定"
        >
          &#9881;
        </button>
      </div>

      <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-px-4 plasmo-space-y-3">
        <div>
          <button
            onClick={onCaptureScreenshot}
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
              <div className="plasmo-absolute plasmo-top-1 plasmo-right-1 plasmo-flex plasmo-gap-1">
                {onEditScreenshot && (
                  <button
                    onClick={onEditScreenshot}
                    className="plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-full plasmo-w-6 plasmo-h-6 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-sm hover:plasmo-bg-blue-600"
                    title="編集"
                  >
                    &#9998;
                  </button>
                )}
                <button
                  onClick={() => onScreenshotChange(null)}
                  className="plasmo-bg-red-500 plasmo-text-white plasmo-rounded-full plasmo-w-6 plasmo-h-6 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-sm hover:plasmo-bg-red-600"
                  title="削除"
                >
                  &#10005;
                </button>
              </div>
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
          <Combobox value={selectedProjectId} onChange={handleProjectChange} onClose={() => setProjectQuery("")}>
            <div className="plasmo-relative">
              <ComboboxInput
                className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                displayValue={(id: string) => {
                  const project = projects.find((p) => String(p.id) === id)
                  return project ? `${project.projectKey} - ${project.name}` : ""
                }}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder="プロジェクトを検索..."
              />
              <ComboboxButton className="plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
                <svg className="plasmo-h-4 plasmo-w-4 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </ComboboxButton>
              <ComboboxOptions className="plasmo-absolute plasmo-z-10 plasmo-mt-1 plasmo-max-h-48 plasmo-w-full plasmo-overflow-auto plasmo-rounded-md plasmo-bg-white plasmo-py-1 plasmo-shadow-lg plasmo-ring-1 plasmo-ring-black/5 plasmo-text-sm">
                {filteredProjects.length === 0 ? (
                  <div className="plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-px-3 plasmo-text-gray-500">
                    該当なし
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <ComboboxOption
                      key={project.id}
                      value={String(project.id)}
                      className="plasmo-group plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-pl-3 plasmo-pr-9 data-[focus]:plasmo-bg-blue-600 data-[focus]:plasmo-text-white plasmo-text-gray-900"
                    >
                      {project.projectKey} - {project.name}
                    </ComboboxOption>
                  ))
                )}
              </ComboboxOptions>
            </div>
          </Combobox>
        </div>

        {issueTypes.length > 0 && (
          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
              課題種別 *
            </label>
            <Combobox value={selectedIssueTypeId} onChange={setSelectedIssueTypeId} onClose={() => setIssueTypeQuery("")}>
              <div className="plasmo-relative">
                <ComboboxInput
                  className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                  displayValue={(id: string) => issueTypes.find((t) => String(t.id) === id)?.name || ""}
                  onChange={(e) => setIssueTypeQuery(e.target.value)}
                  placeholder="課題種別を検索..."
                />
                <ComboboxButton className="plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
                  <svg className="plasmo-h-4 plasmo-w-4 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                </ComboboxButton>
                <ComboboxOptions className="plasmo-absolute plasmo-z-10 plasmo-mt-1 plasmo-max-h-48 plasmo-w-full plasmo-overflow-auto plasmo-rounded-md plasmo-bg-white plasmo-py-1 plasmo-shadow-lg plasmo-ring-1 plasmo-ring-black/5 plasmo-text-sm">
                  {filteredIssueTypes.length === 0 ? (
                    <div className="plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-px-3 plasmo-text-gray-500">
                      該当なし
                    </div>
                  ) : (
                    filteredIssueTypes.map((type) => (
                      <ComboboxOption
                        key={type.id}
                        value={String(type.id)}
                        className="plasmo-group plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-pl-3 plasmo-pr-9 data-[focus]:plasmo-bg-blue-600 data-[focus]:plasmo-text-white plasmo-text-gray-900"
                      >
                        {type.name}
                      </ComboboxOption>
                    ))
                  )}
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>
        )}

        <div>
          <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
            優先度 *
          </label>
          <div className="plasmo-relative">
            <select
              value={selectedPriorityId}
              onChange={(e) => setSelectedPriorityId(e.target.value)}
              className="plasmo-w-full plasmo-appearance-none plasmo-px-3 plasmo-py-2 plasmo-pr-10 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm plasmo-bg-white focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
            >
              <option value="">選択してください</option>
              {priorities.map((priority) => (
                <option key={priority.id} value={String(priority.id)}>
                  {priority.name}
                </option>
              ))}
            </select>
            <div className="plasmo-pointer-events-none plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
              <svg className="plasmo-h-4 plasmo-w-4 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {users.length > 0 && (
          <div>
            <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
              担当者
            </label>
            <Combobox value={selectedAssigneeId} onChange={setSelectedAssigneeId} onClose={() => setAssigneeQuery("")}>
              <div className="plasmo-relative">
                <ComboboxInput
                  className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                  displayValue={(id: string) => users.find((u) => String(u.id) === id)?.name || ""}
                  onChange={(e) => setAssigneeQuery(e.target.value)}
                  placeholder="担当者を検索..."
                />
                <ComboboxButton className="plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
                  <svg className="plasmo-h-4 plasmo-w-4 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </ComboboxButton>
                <ComboboxOptions className="plasmo-absolute plasmo-z-10 plasmo-mt-1 plasmo-max-h-48 plasmo-w-full plasmo-overflow-auto plasmo-rounded-md plasmo-bg-white plasmo-py-1 plasmo-shadow-lg plasmo-ring-1 plasmo-ring-black/5 plasmo-text-sm">
                  {filteredUsers.length === 0 ? (
                    <div className="plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-px-3 plasmo-text-gray-500">
                      該当なし
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <ComboboxOption
                        key={user.id}
                        value={String(user.id)}
                        className="plasmo-group plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-pl-3 plasmo-pr-9 data-[focus]:plasmo-bg-blue-600 data-[focus]:plasmo-text-white plasmo-text-gray-900"
                      >
                        {user.name}
                      </ComboboxOption>
                    ))
                  )}
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>
        )}

        {errorMessage && (
          <p className="plasmo-text-sm plasmo-text-red-600">{errorMessage}</p>
        )}
      </div>

      <div className="plasmo-p-4 plasmo-pt-2 plasmo-bg-white plasmo-space-y-2" style={{ boxShadow: "0 -2px 8px rgba(0,0,0,0.06)" }}>
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
  )
}
