import { useEffect, useState } from 'react'
import type { AppState } from '@shared/ipc'

/** Current app state from main, kept live by the state event. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null)
  useEffect(() => {
    const apply = (s: AppState): void => {
      document.documentElement.dataset['glass'] = String(s.glass) // base.css falls back to a solid surface
      setState(s)
    }
    void window.assistant.getState().then(apply)
    return window.assistant.onState(apply)
  }, [])
  return state
}
