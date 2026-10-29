import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AppState, ConversationSummary, MemoryItem, MemoryKind } from '@shared/ipc'

const when = (ms: number): string => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function MemorySettings({ state }: { state: AppState }): React.JSX.Element {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [chats, setChats] = useState<ConversationSummary[]>([])
  const [kind, setKind] = useState<MemoryKind>('memory')
  const [text, setText] = useState('')
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  const refresh = useCallback(async () => {
    const [m, c] = await Promise.all([window.assistant.memory.list(), window.assistant.history.list()])
    setItems(m)
    setChats(c)
  }, [])
  useEffect(() => {
    void refresh()
    return window.assistant.onDataChanged(() => void refresh())
  }, [refresh])

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault()
    const result = await window.assistant.memory.add(kind, text)
    if (!result.ok) return setMessage({ error: true, text: result.message })
    setText('')
    setMessage({ error: false, text: kind === 'memory' ? 'Saved. I’ll keep it in mind.' : 'Note saved.' })
  }

  const memories = items.filter((i) => i.kind === 'memory')
  const notes = items.filter((i) => i.kind === 'note')

  const list = (rows: MemoryItem[], empty: string): React.JSX.Element =>
    rows.length ? (
      <ul className="data-list">
        {rows.map((m) => (
          <li key={m.id}>
            <span className="selectable">{m.text}</span>
            <button type="button" className="secondary small" onClick={() => void window.assistant.memory.delete(m.id)} aria-label={`Delete: ${m.text}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="model-license">{empty}</p>
    )

  return (
    <>
      <section aria-labelledby="memory-heading">
        <h2 id="memory-heading">Memory</h2>
        <p className="model-license">
          Memories are given to the AI with every message. Notes are only for you. In chat you can type <kbd>/remember …</kbd> or{' '}
          <kbd>/note …</kbd>.
        </p>
        <h3>Memories</h3>
        {list(memories, 'Nothing saved yet. Try: /remember I prefer short answers')}
        <h3>Notes</h3>
        {list(notes, 'No notes yet.')}
        <form className="inline add-memory" onSubmit={(e) => void add(e)}>
          <label className="visually-hidden" htmlFor="memory-kind">
            Type
          </label>
          <select id="memory-kind" value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)}>
            <option value="memory">Memory</option>
            <option value="note">Note</option>
          </select>
          <label className="visually-hidden" htmlFor="memory-text">
            Text
          </label>
          <input id="memory-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Something to keep" maxLength={1000} />
          <button type="submit" disabled={!text.trim()}>
            Add
          </button>
        </form>
        {message && (
          <p className={message.error ? 'warn' : 'model-license'} role={message.error ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
      </section>

      <section aria-labelledby="data-heading">
        <h2 id="data-heading">Chat history</h2>
        <label className="row">
          <span>
            Save chats
            <small>Your last chat comes back after a restart. Stored only on this computer.</small>
          </span>
          <input type="checkbox" checked={state.historyEnabled} onChange={(e) => void window.assistant.history.setEnabled(e.target.checked)} />
        </label>
        {chats.length ? (
          <ul className="data-list">
            {chats.map((c) => (
              <li key={c.id}>
                <span>
                  {c.title}
                  <small>
                    {when(c.updatedAt)} · {c.messages} message{c.messages === 1 ? '' : 's'}
                  </small>
                </span>
                <button type="button" className="secondary small" onClick={() => void window.assistant.history.delete(c.id)} aria-label={`Delete chat: ${c.title}`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="model-license">No saved chats.</p>
        )}
        <div className="model-actions">
          <button type="button" className="secondary" onClick={() => void window.assistant.history.deleteAll()} disabled={!chats.length}>
            Delete all chats
          </button>
          {confirmAll ? (
            <>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setConfirmAll(false)
                  void window.assistant.deleteAllData()
                }}
              >
                Yes, delete everything
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmAll(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="secondary" onClick={() => setConfirmAll(true)} disabled={!chats.length && !items.length}>
              Delete all my data…
            </button>
          )}
        </div>
        {confirmAll && <p className="warn">This deletes every saved chat, memory and note. Settings and your API key are kept.</p>}
      </section>
    </>
  )
}
