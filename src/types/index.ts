export interface BacklogConfig {
  apiKey: string
  space: string
  defaults?: {
    projectId?: string
    issueTypeId?: string
    priorityId?: string
    assigneeId?: string
  }
}

export interface BacklogProject {
  id: number
  projectKey: string
  name: string
  chartEnabled: boolean
  subtaskingEnabled: boolean
  projectLeaderCanEditProjectLeader: boolean
  useWikiTreeView: boolean
  textFormattingRule: string
  archived: boolean
  displayOrder: number
}

export interface BacklogIssueType {
  id: number
  projectId: number
  name: string
  color: string
  displayOrder: number
}

export interface BacklogPriority {
  id: number
  name: string
}

export interface BacklogUser {
  id: number
  userId: string
  name: string
  roleType: number
  lang: string
  mailAddress: string
}

export interface BacklogCategory {
  id: number
  name: string
  displayOrder: number
}

export interface BacklogIssue {
  id: number
  projectId: number
  issueKey: string
  keyId: number
  issueType: BacklogIssueType
  summary: string
  description: string
  resolution?: unknown
  priority: BacklogPriority
  status: {
    id: number
    name: string
  }
  assignee?: BacklogUser
  category: unknown[]
  versions: unknown[]
  milestone: unknown[]
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
  parentIssueId?: number
  createdUser: BacklogUser
  created: string
  updatedUser: BacklogUser
  updated: string
  customFields: unknown[]
  attachments: unknown[]
  sharedFiles: unknown[]
  stars: unknown[]
}

export interface CreateIssueParams {
  projectId: string
  summary: string
  issueTypeId: string
  priorityId: string
  description?: string
  assigneeId?: string
  categoryId?: string[]
  versionId?: string[]
  milestoneId?: string[]
  parentIssueId?: string
  estimatedHours?: number
  actualHours?: number
  startDate?: string
  dueDate?: string
  attachmentId?: string[]
}

export interface BacklogAttachment {
  id: number
  name: string
  size: number
}
