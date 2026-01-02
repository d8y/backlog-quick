import { useState, useEffect, useCallback } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"

import { BacklogAPIClient } from "~lib/backlog-api"
import type { BacklogProject, BacklogIssueType, BacklogPriority, BacklogUser } from "~types"

import "~style.css"

const storage = new Storage({ area: "sync" })

interface Defaults {
  projectId: string
  issueTypeId: string
  priorityId: string
  assigneeId: string
}

function OptionsPage() {
  const [apiKey, setApiKey] = useStorage({ key: "apiKey", instance: storage })
  const [space, setSpace] = useStorage({ key: "space", instance: storage })
  const [defaults, setDefaults] = useStorage<Defaults>({ key: "defaults", instance: storage })

  const [localApiKey, setLocalApiKey] = useState("")
  const [localSpace, setLocalSpace] = useState("")

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState("")

  const [projects, setProjects] = useState<BacklogProject[]>([])
  const [issueTypes, setIssueTypes] = useState<BacklogIssueType[]>([])
  const [priorities, setPriorities] = useState<BacklogPriority[]>([])
  const [users, setUsers] = useState<BacklogUser[]>([])

  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [selectedIssueTypeId, setSelectedIssueTypeId] = useState("")
  const [selectedPriorityId, setSelectedPriorityId] = useState("")
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")

  const [loading, setLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    if (apiKey) setLocalApiKey(apiKey)
    if (space) setLocalSpace(space)
  }, [apiKey, space])

  useEffect(() => {
    if (defaults) {
      setSelectedProjectId(defaults.projectId || "")
      setSelectedIssueTypeId(defaults.issueTypeId || "")
      setSelectedPriorityId(defaults.priorityId || "")
      setSelectedAssigneeId(defaults.assigneeId || "")
    }
  }, [defaults])

  const handleTestConnection = useCallback(async () => {
    if (!localApiKey || !localSpace) {
      setTestMessage("APIキーとスペースを入力してください")
      setTestStatus("error")
      return
    }

    setTestStatus("testing")
    setTestMessage("")

    try {
      const client = new BacklogAPIClient(localSpace, localApiKey)
      await client.testConnection()
      setTestStatus("success")
      setTestMessage("接続成功")

      await setApiKey(localApiKey)
      await setSpace(localSpace)

      const projectList = await client.getProjects()
      setProjects(projectList.filter((p) => !p.archived))

      const priorityList = await client.getPriorities()
      setPriorities(priorityList)
    } catch (error) {
      setTestStatus("error")
      setTestMessage(error instanceof Error ? error.message : "接続に失敗しました")
    }
  }, [localApiKey, localSpace, setApiKey, setSpace])

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      setSelectedProjectId(projectId)
      setSelectedIssueTypeId("")
      setSelectedAssigneeId("")
      setIssueTypes([])
      setUsers([])

      if (!projectId || !apiKey || !space) return

      setLoading(true)
      try {
        const client = new BacklogAPIClient(space, apiKey)
        const [issueTypeList, userList] = await Promise.all([
          client.getIssueTypes(projectId),
          client.getUsers(projectId),
        ])
        setIssueTypes(issueTypeList)
        setUsers(userList)
      } catch (error) {
        console.error("Failed to load project data:", error)
      } finally {
        setLoading(false)
      }
    },
    [apiKey, space]
  )

  useEffect(() => {
    if (defaults?.projectId && projects.length > 0 && apiKey && space) {
      handleProjectChange(defaults.projectId)
    }
  }, [defaults?.projectId, projects.length, apiKey, space])

  const handleSaveDefaults = useCallback(async () => {
    const newDefaults: Defaults = {
      projectId: selectedProjectId,
      issueTypeId: selectedIssueTypeId,
      priorityId: selectedPriorityId,
      assigneeId: selectedAssigneeId,
    }
    await setDefaults(newDefaults)
    setSaveMessage("保存しました")
    setTimeout(() => setSaveMessage(""), 2000)
  }, [selectedProjectId, selectedIssueTypeId, selectedPriorityId, selectedAssigneeId, setDefaults])

  return (
    <div className="plasmo-min-h-screen plasmo-bg-gray-50 plasmo-py-8">
      <div className="plasmo-max-w-xl plasmo-mx-auto plasmo-px-4">
        <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-text-gray-900 plasmo-mb-6">
          Backlog Quick 設定
        </h1>

        <div className="plasmo-bg-white plasmo-rounded-lg plasmo-shadow plasmo-p-6 plasmo-mb-6">
          <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-gray-800 plasmo-mb-4">
            API設定
          </h2>

          <div className="plasmo-space-y-4">
            <div>
              <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
                スペース
              </label>
              <input
                type="text"
                value={localSpace}
                onChange={(e) => setLocalSpace(e.target.value)}
                placeholder="example.backlog.com"
                className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
              />
            </div>

            <div>
              <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
                APIキー
              </label>
              <input
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="APIキーを入力"
                className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
              />
            </div>

            <div className="plasmo-flex plasmo-items-center plasmo-gap-4">
              <button
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
                className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-blue-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
              >
                {testStatus === "testing" ? "接続中..." : "接続テスト"}
              </button>

              {testMessage && (
                <span
                  className={`plasmo-text-sm ${
                    testStatus === "success" ? "plasmo-text-green-600" : "plasmo-text-red-600"
                  }`}
                >
                  {testMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="plasmo-bg-white plasmo-rounded-lg plasmo-shadow plasmo-p-6">
            <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-gray-800 plasmo-mb-4">
              デフォルト設定
            </h2>

            <div className="plasmo-space-y-4">
              <div>
                <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
                  プロジェクト
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
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
                    課題種別
                  </label>
                  <select
                    value={selectedIssueTypeId}
                    onChange={(e) => setSelectedIssueTypeId(e.target.value)}
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
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

              {priorities.length > 0 && (
                <div>
                  <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
                    優先度
                  </label>
                  <select
                    value={selectedPriorityId}
                    onChange={(e) => setSelectedPriorityId(e.target.value)}
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {priorities.map((priority) => (
                      <option key={priority.id} value={String(priority.id)}>
                        {priority.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {users.length > 0 && (
                <div>
                  <label className="plasmo-block plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-1">
                    担当者
                  </label>
                  <select
                    value={selectedAssigneeId}
                    onChange={(e) => setSelectedAssigneeId(e.target.value)}
                    className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {users.map((user) => (
                      <option key={user.id} value={String(user.id)}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {loading && (
                <p className="plasmo-text-sm plasmo-text-gray-500">読み込み中...</p>
              )}

              <div className="plasmo-flex plasmo-items-center plasmo-gap-4 plasmo-pt-2">
                <button
                  onClick={handleSaveDefaults}
                  disabled={!selectedProjectId}
                  className="plasmo-px-4 plasmo-py-2 plasmo-bg-green-600 plasmo-text-white plasmo-rounded-md plasmo-font-medium hover:plasmo-bg-green-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
                >
                  保存
                </button>

                {saveMessage && (
                  <span className="plasmo-text-sm plasmo-text-green-600">{saveMessage}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OptionsPage
