import type { IBacklogAPIClient } from "./backlog-api-interface"
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
import {
  mockProjects,
  mockIssueTypes,
  mockPriorities,
  mockUsers,
  mockCategories,
} from "./mock-data"

export interface MockConfig {
  shouldFail?: boolean
  failureMessage?: string
  delayMs?: number
}

export class MockBacklogAPIClient implements IBacklogAPIClient {
  private readonly space: string
  private readonly mockConfig: MockConfig

  constructor(space: string, apiKey: string, mockConfig: MockConfig = {}) {
    // 本番と同様のバリデーション
    if (!space || !apiKey) {
      throw new Error("Backlog API credentials are required")
    }

    // URLの形式チェック（https:// や http:// で始まる場合はエラー）
    if (space.startsWith("https://") || space.startsWith("http://")) {
      throw new Error(
        "Please enter the space URL in the format 'example.backlog.com'. Do not include 'https://'."
      )
    }

    this.space = space
    this.mockConfig = {
      delayMs: parseInt(process.env.PLASMO_PUBLIC_MOCK_DELAY || "500", 10),
      ...mockConfig,
    }
    console.log("[MOCK] BacklogAPIClient initialized", { space, mockConfig: this.mockConfig })
  }

  private async delay(): Promise<void> {
    if (this.mockConfig.delayMs && this.mockConfig.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.mockConfig.delayMs))
    }
  }

  private async maybeThrow(): Promise<void> {
    await this.delay()
    if (this.mockConfig.shouldFail) {
      throw new Error(this.mockConfig.failureMessage || "[MOCK] Simulated API error")
    }
  }

  async getProjects(): Promise<BacklogProject[]> {
    await this.maybeThrow()
    console.log("[MOCK] getProjects")
    return mockProjects
  }

  async getProject(projectIdOrKey: string): Promise<BacklogProject> {
    await this.maybeThrow()
    console.log("[MOCK] getProject", projectIdOrKey)
    const project = mockProjects.find(
      (p) => String(p.id) === projectIdOrKey || p.projectKey === projectIdOrKey
    )
    return project || mockProjects[0]
  }

  async getIssueTypes(_projectIdOrKey: string): Promise<BacklogIssueType[]> {
    await this.maybeThrow()
    console.log("[MOCK] getIssueTypes", _projectIdOrKey)
    return mockIssueTypes
  }

  async getPriorities(): Promise<BacklogPriority[]> {
    await this.maybeThrow()
    console.log("[MOCK] getPriorities")
    return mockPriorities
  }

  async getUsers(_projectIdOrKey: string): Promise<BacklogUser[]> {
    await this.maybeThrow()
    console.log("[MOCK] getUsers", _projectIdOrKey)
    return mockUsers
  }

  async getCategories(_projectIdOrKey: string): Promise<BacklogCategory[]> {
    await this.maybeThrow()
    console.log("[MOCK] getCategories", _projectIdOrKey)
    return mockCategories
  }

  async createIssue(params: CreateIssueParams): Promise<BacklogIssue> {
    await this.maybeThrow()
    const issueKey = `DEMO-${Math.floor(Math.random() * 1000)}`
    console.log("[MOCK] createIssue", issueKey, params.summary)

    return {
      id: Math.floor(Math.random() * 10000),
      projectId: parseInt(params.projectId),
      issueKey,
      keyId: Math.floor(Math.random() * 1000),
      issueType: mockIssueTypes[0],
      summary: params.summary,
      description: params.description || "",
      priority: mockPriorities[1],
      status: { id: 1, name: "Open" },
      category: [],
      versions: [],
      milestone: [],
      createdUser: mockUsers[0],
      created: new Date().toISOString(),
      updatedUser: mockUsers[0],
      updated: new Date().toISOString(),
      customFields: [],
      attachments: [],
      sharedFiles: [],
      stars: [],
    }
  }

  async uploadAttachmentFromBlob(_blob: Blob, filename: string): Promise<BacklogAttachment> {
    await this.maybeThrow()
    console.log("[MOCK] uploadAttachmentFromBlob", filename)
    return {
      id: Math.floor(Math.random() * 10000),
      name: filename,
      size: 1024,
    }
  }

  async getMyself(): Promise<BacklogUser> {
    await this.maybeThrow()
    console.log("[MOCK] getMyself")
    return mockUsers[0]
  }

  async testConnection(): Promise<boolean> {
    await this.maybeThrow()
    console.log("[MOCK] testConnection")
    return true
  }

  getIssueUrl(issueKey: string): string {
    return `https://${this.space}/view/${issueKey}`
  }
}
