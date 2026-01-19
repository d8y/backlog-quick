import type {
  BacklogProject,
  BacklogIssue,
  BacklogIssueType,
  BacklogPriority,
  BacklogUser,
  BacklogCategory,
  CreateIssueParams,
  BacklogAttachment,
} from "~types"

/**
 * Backlog API クライアントのインターフェース
 */
export interface IBacklogAPIClient {
  getProjects(): Promise<BacklogProject[]>
  getProject(projectIdOrKey: string): Promise<BacklogProject>
  getIssueTypes(projectIdOrKey: string): Promise<BacklogIssueType[]>
  getPriorities(): Promise<BacklogPriority[]>
  getUsers(projectIdOrKey: string): Promise<BacklogUser[]>
  getCategories(projectIdOrKey: string): Promise<BacklogCategory[]>
  createIssue(params: CreateIssueParams): Promise<BacklogIssue>
  uploadAttachmentFromBlob(blob: Blob, filename: string): Promise<BacklogAttachment>
  getMyself(): Promise<BacklogUser>
  testConnection(): Promise<boolean>
  getIssueUrl(issueKey: string): string
}
