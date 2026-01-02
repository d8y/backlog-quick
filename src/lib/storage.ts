import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

export interface StorageDefaults {
  projectId: string
  issueTypeId: string
  priorityId: string
  assigneeId: string
}

export interface StorageData {
  apiKey: string
  space: string
  defaults: StorageDefaults
}

const storage = new Storage({ area: "sync" })

export const STORAGE_KEYS = {
  API_KEY: "apiKey",
  SPACE: "space",
  DEFAULTS: "defaults",
} as const

export function useApiKey() {
  return useStorage<string>({
    key: STORAGE_KEYS.API_KEY,
    instance: storage,
  })
}

export function useSpace() {
  return useStorage<string>({
    key: STORAGE_KEYS.SPACE,
    instance: storage,
  })
}

export function useDefaults() {
  return useStorage<StorageDefaults>({
    key: STORAGE_KEYS.DEFAULTS,
    instance: storage,
  })
}

export async function getApiKey(): Promise<string | undefined> {
  return storage.get<string>(STORAGE_KEYS.API_KEY)
}

export async function getSpace(): Promise<string | undefined> {
  return storage.get<string>(STORAGE_KEYS.SPACE)
}

export async function getDefaults(): Promise<StorageDefaults | undefined> {
  return storage.get<StorageDefaults>(STORAGE_KEYS.DEFAULTS)
}

export async function setApiKey(value: string): Promise<void> {
  return storage.set(STORAGE_KEYS.API_KEY, value)
}

export async function setSpace(value: string): Promise<void> {
  return storage.set(STORAGE_KEYS.SPACE, value)
}

export async function setDefaults(value: StorageDefaults): Promise<void> {
  return storage.set(STORAGE_KEYS.DEFAULTS, value)
}

export async function isConfigured(): Promise<boolean> {
  const apiKey = await getApiKey()
  const space = await getSpace()
  return Boolean(apiKey && space)
}

export { storage }
