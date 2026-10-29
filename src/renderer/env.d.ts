import type { AssistantApi } from '@shared/ipc'

declare global {
  interface Window {
    assistant: AssistantApi
  }
}

export {}
