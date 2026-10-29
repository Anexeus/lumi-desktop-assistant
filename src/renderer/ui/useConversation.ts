import { useEffect, useState } from 'react'
import type { ChatSnapshot } from '@shared/ipc'

/** The shared conversation from main, with streamed text applied as it arrives. */
export function useConversation(): ChatSnapshot {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>({ items: [], status: 'idle' })
  useEffect(() => {
    let live = true
    void window.assistant.chat.get().then((s) => live && setSnapshot(s))
    const off = window.assistant.chat.onEvent((event) => {
      if (event.type === 'snapshot') return setSnapshot(event.snapshot)
      setSnapshot((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === event.id ? { ...i, text: i.text + event.text } : i))
      }))
    })
    return () => {
      live = false
      off()
    }
  }, [])
  return snapshot
}
