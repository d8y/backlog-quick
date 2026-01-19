import type { IBacklogAPIClient } from "./backlog-api-interface"
import { BacklogAPIClient } from "./backlog-api"
import { MockBacklogAPIClient, type MockConfig } from "./backlog-api-mock"

/**
 * API クライアントのファクトリ関数
 * 環境変数 PLASMO_PUBLIC_USE_MOCK_API に基づいて適切な実装を返す
 */
export function createBacklogAPIClient(
  space: string,
  apiKey: string,
  mockConfig?: MockConfig
): IBacklogAPIClient {
  if (process.env.PLASMO_PUBLIC_USE_MOCK_API === "true") {
    console.log("[DEV] Using Mock Backlog API Client")
    return new MockBacklogAPIClient(space, apiKey, mockConfig)
  }

  return new BacklogAPIClient(space, apiKey)
}

export type { IBacklogAPIClient, MockConfig }
