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

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>
  timeout?: number
}

export class BacklogAPIClient {
  private readonly baseURL: string
  private readonly apiKey: string
  private defaultTimeout: number = 30000

  constructor(space: string, apiKey: string) {
    if (!space || !apiKey) {
      throw new Error("Backlog API credentials are required")
    }
    this.baseURL = `https://${space}/api/v2`
    this.apiKey = apiKey
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = this.defaultTimeout
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout")
      }
      if (error instanceof Error) {
        error.message = `${error.message} (URL: ${url})`
      }
      throw error
    }
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { params = {}, timeout, ...fetchOptions } = options

    params.apiKey = this.apiKey

    const url = new URL(`${this.baseURL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    try {
      const response = await this.fetchWithTimeout(
        url.toString(),
        {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
          },
        },
        timeout
      )

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("fetch failed") || error.message.includes("Failed to fetch")) {
          throw new Error(
            `Failed to connect to ${this.baseURL}. Please check:\n- Your internet connection\n- The Backlog space URL is correct (e.g., yourspace.backlog.com)\n\nOriginal error: ${error.message}`
          )
        }
        throw error
      }
      throw new Error("No response from Backlog server. Please check your internet connection.")
    }
  }

  private async handleErrorResponse(response: Response): Promise<void> {
    const status = response.status
    let message = "Backlog API error"

    try {
      const errorData = (await response.json()) as { errors?: { message: string }[] }
      if (errorData?.errors) {
        message = errorData.errors.map((e) => e.message).join(", ")
      }
    } catch {
      // Failed to parse error response
    }

    if (status === 401) {
      message = "Invalid API key or unauthorized access"
    } else if (status === 404) {
      message = "Resource not found"
    } else if (status === 429) {
      message = "Rate limit exceeded. Please try again later"
    }

    throw new Error(`${message} (Status: ${status})`)
  }

  async getProjects(): Promise<BacklogProject[]> {
    return this.request<BacklogProject[]>("/projects")
  }

  async getProject(projectIdOrKey: string): Promise<BacklogProject> {
    return this.request<BacklogProject>(`/projects/${projectIdOrKey}`)
  }

  async getIssueTypes(projectIdOrKey: string): Promise<BacklogIssueType[]> {
    return this.request<BacklogIssueType[]>(`/projects/${projectIdOrKey}/issueTypes`)
  }

  async getPriorities(): Promise<BacklogPriority[]> {
    return this.request<BacklogPriority[]>("/priorities")
  }

  async getUsers(projectIdOrKey: string): Promise<BacklogUser[]> {
    return this.request<BacklogUser[]>(`/projects/${projectIdOrKey}/users`)
  }

  async getCategories(projectIdOrKey: string): Promise<BacklogCategory[]> {
    return this.request<BacklogCategory[]>(`/projects/${projectIdOrKey}/categories`)
  }

  async createIssue(params: CreateIssueParams): Promise<BacklogIssue> {
    const formData = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => formData.append(`${key}[]`, String(v)))
        } else {
          formData.append(key, String(value))
        }
      }
    })

    return this.request<BacklogIssue>("/issues", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })
  }

  async uploadAttachmentFromBlob(
    blob: Blob,
    filename: string
  ): Promise<BacklogAttachment> {
    const formData = new FormData()
    const file = new File([blob], filename, { type: blob.type || "image/png" })
    formData.append("file", file)

    const url = new URL(`${this.baseURL}/space/attachment`)
    url.searchParams.append("apiKey", this.apiKey)

    try {
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      const data = await response.json()
      return data as BacklogAttachment
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Failed to upload attachment")
    }
  }

  async getMyself(): Promise<BacklogUser> {
    return this.request<BacklogUser>("/users/myself")
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getMyself()
      return true
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Connection test failed")
    }
  }

  getIssueUrl(issueKey: string): string {
    const space = this.baseURL.match(/https:\/\/(.+)\/api/)?.[1] || ""
    return `https://${space}/view/${issueKey}`
  }
}

export default BacklogAPIClient
