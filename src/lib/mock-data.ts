import type {
  BacklogProject,
  BacklogIssueType,
  BacklogPriority,
  BacklogUser,
  BacklogCategory,
} from "~types"

export const mockProjects: BacklogProject[] = [
  {
    id: 1,
    projectKey: "DEMO",
    name: "Demo Project",
    chartEnabled: true,
    subtaskingEnabled: true,
    projectLeaderCanEditProjectLeader: true,
    useWikiTreeView: true,
    textFormattingRule: "markdown",
    archived: false,
    displayOrder: 0,
  },
  {
    id: 2,
    projectKey: "TEST",
    name: "Test Project",
    chartEnabled: true,
    subtaskingEnabled: true,
    projectLeaderCanEditProjectLeader: true,
    useWikiTreeView: true,
    textFormattingRule: "markdown",
    archived: false,
    displayOrder: 1,
  },
]

export const mockIssueTypes: BacklogIssueType[] = [
  { id: 1, projectId: 1, name: "Bug", color: "#e30000", displayOrder: 0 },
  { id: 2, projectId: 1, name: "Task", color: "#4488cc", displayOrder: 1 },
  { id: 3, projectId: 1, name: "Feature", color: "#5eb5a6", displayOrder: 2 },
]

export const mockPriorities: BacklogPriority[] = [
  { id: 2, name: "High" },
  { id: 3, name: "Medium" },
  { id: 4, name: "Low" },
]

export const mockUsers: BacklogUser[] = [
  {
    id: 1,
    userId: "mock-user-1",
    name: "Mock User",
    roleType: 1,
    lang: "ja",
    mailAddress: "mock@example.com",
  },
  {
    id: 2,
    userId: "mock-user-2",
    name: "Test User",
    roleType: 2,
    lang: "ja",
    mailAddress: "test@example.com",
  },
]

export const mockCategories: BacklogCategory[] = [
  { id: 1, name: "Frontend", displayOrder: 0 },
  { id: 2, name: "Backend", displayOrder: 1 },
]
