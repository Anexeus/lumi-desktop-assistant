import { useEffect, useState } from 'react'
import type { AppState } from '@shared/ipc'

/** Current app state from main, kept live by the state event. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null)
  useEffect(() => {
    void window.assistant.getState().then(setState)
    return window.assistant.onState(setState)
  }, [])
  return state
}
