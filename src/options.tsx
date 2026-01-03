import { useState, useEffect, useCallback, useMemo } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from "@headlessui/react"

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
                <Combobox value={selectedProjectId} onChange={handleProjectChange} onClose={() => setProjectQuery("")}>
                  <div className="plasmo-relative">
                    <ComboboxInput
                      className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                      displayValue={(id: string) => {
                        const project = projects.find((p) => String(p.id) === id)
                        return project ? `${project.projectKey} - ${project.name}` : ""
                      }}
                      onChange={(e) => setProjectQuery(e.target.value)}
                      placeholder="プロジェクトを検索..."
                    />
                    <ComboboxButton className="plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
                      <svg className="plasmo-h-5 plasmo-w-5 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </ComboboxButton>
                    <ComboboxOptions className="plasmo-absolute plasmo-z-10 plasmo-mt-1 plasmo-max-h-60 plasmo-w-full plasmo-overflow-auto plasmo-rounded-md plasmo-bg-white plasmo-py-1 plasmo-shadow-lg plasmo-ring-1 plasmo-ring-black/5">
                      {filteredProjects.length === 0 ? (
                        <div className="plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-px-3 plasmo-text-gray-500">
                          該当するプロジェクトがありません
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
                    課題種別
                  </label>
                  <Combobox value={selectedIssueTypeId} onChange={setSelectedIssueTypeId} onClose={() => setIssueTypeQuery("")}>
                    <div className="plasmo-relative">
                      <ComboboxInput
                        className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                        displayValue={(id: string) => issueTypes.find((t) => String(t.id) === id)?.name || ""}
                        onChange={(e) => setIssueTypeQuery(e.target.value)}
                        placeholder="課題種別を検索..."
                      />
                      <ComboboxButton className="plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
                        <svg className="plasmo-h-5 plasmo-w-5 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </ComboboxButton>
                      <ComboboxOptions className="plasmo-absolute plasmo-z-10 plasmo-mt-1 plasmo-max-h-60 plasmo-w-full plasmo-overflow-auto plasmo-rounded-md plasmo-bg-white plasmo-py-1 plasmo-shadow-lg plasmo-ring-1 plasmo-ring-black/5">
                        {filteredIssueTypes.length === 0 ? (
                          <div className="plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-px-3 plasmo-text-gray-500">
                            該当する課題種別がありません
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
                  <Combobox value={selectedAssigneeId} onChange={setSelectedAssigneeId} onClose={() => setAssigneeQuery("")}>
                    <div className="plasmo-relative">
                      <ComboboxInput
                        className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-shadow-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 focus:plasmo-border-blue-500"
                        displayValue={(id: string) => users.find((u) => String(u.id) === id)?.name || ""}
                        onChange={(e) => setAssigneeQuery(e.target.value)}
                        placeholder="担当者を検索..."
                      />
                      <ComboboxButton className="plasmo-absolute plasmo-inset-y-0 plasmo-right-0 plasmo-flex plasmo-items-center plasmo-pr-3">
                        <svg className="plasmo-h-5 plasmo-w-5 plasmo-text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </ComboboxButton>
                      <ComboboxOptions className="plasmo-absolute plasmo-z-10 plasmo-mt-1 plasmo-max-h-60 plasmo-w-full plasmo-overflow-auto plasmo-rounded-md plasmo-bg-white plasmo-py-1 plasmo-shadow-lg plasmo-ring-1 plasmo-ring-black/5">
                        {filteredUsers.length === 0 ? (
                          <div className="plasmo-relative plasmo-cursor-default plasmo-select-none plasmo-py-2 plasmo-px-3 plasmo-text-gray-500">
                            該当する担当者がいません
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
