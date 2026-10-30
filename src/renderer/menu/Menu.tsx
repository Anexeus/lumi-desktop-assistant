import type { CharacterState } from '@shared/character'
import { CHARACTERS } from '@shared/characters'
import type { MenuAction } from '@shared/ipc'
import { formatAccelerator } from '@shared/shortcuts'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Orb } from '../ui/Orb'
import { useAppState } from '../ui/useAppState'

const STATUS: Record<CharacterState, string> = {
  IDLE: 'Ready',
  LISTENING: 'Listening',
  THINKING: 'Thinking…',
  SPEAKING: 'Talking',
  WORKING: 'Working on it…',
  NOTIFICATION: 'Has something for you',
  ERROR: 'Something went wrong'
}

// 16 px stroke icons, drawn in the text colour.
const ICONS: Record<string, string> = {
  chat: 'M4 5h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  settings: 'M4 6h8M15 6h1M4 14h1M8 14h8M13 4v4M6 12v4',
  hide: 'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  pin: 'M7 3h6l-1 5 3 3H5l3-3-1-5zM10 11v6',
  stop: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7.5 7.5h5v5h-5z',
  quit: 'M10 2.5v7M5.6 5.4a6.5 6.5 0 1 0 8.8 0',
  character: 'M10 9.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM3.5 17.5c.6-3.3 3.3-5 6.5-5s5.9 1.7 6.5 5',
  back: 'M12 4l-6 6 6 6'
}
const Icon = ({ name }: { name: keyof typeof ICONS }): React.JSX.Element => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** The menu for the character and the tray icon: the island's black glass, opened at the pointer. */
export function Menu(): React.JSX.Element {
  const state = useAppState()
  const list = useRef<HTMLDivElement>(null)
  const [opened, setOpened] = useState(0) // bumped each time the menu opens: replays the entrance, focuses the first item
  const [view, setView] = useState<'main' | 'characters'>('main')

  useEffect(() => {
    const onFocus = (): void => {
      setView('main')
      setOpened((n) => n + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]')?.focus()
  }, [opened, view, state === null])

  if (!state) return <div className="menu" />
  const name = state.assistantName
  const run = (action: MenuAction): void => void window.assistant.menu.run(action)

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') return run('close')
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const items = [...list.current!.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  if (view === 'characters') {
    return (
      <div key={opened} ref={list} className="menu" role="menu" aria-label="Characters" onKeyDown={onKeyDown}>
        <button type="button" role="menuitem" onClick={() => setView('main')}>
          <Icon name="back" /> Characters
        </button>
        <hr />
        <div className="menu-list">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitemradio"
              aria-checked={state.model.id === c.id}
              onClick={() => {
                void window.assistant.model.select(c.id)
                run('close')
              }}
            >
              <span className="check" aria-hidden="true">
                {state.model.id === c.id ? '✓' : ''}
              </span>
              {c.name}
              <small>{c.voice}</small>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div key={opened} ref={list} className="menu" role="menu" aria-label={`${name} menu`} onKeyDown={onKeyDown}>
      <div className="menu-head">
        <Orb mode={state.controlling ? 'controlling' : state.character === 'THINKING' || state.character === 'WORKING' ? 'thinking' : 'idle'} />
        <span>
          <strong>{name}</strong>
          <small>{state.controlling ? 'Using your PC' : STATUS[state.character]}</small>
        </span>
      </div>
      <button type="button" role="menuitem" onClick={() => run('chat')}>
        <Icon name="chat" /> Chat
      </button>
      <button type="button" role="menuitem" onClick={() => run('settings')}>
        <Icon name="settings" /> Settings
      </button>
      <button type="button" role="menuitem" onClick={() => setView('characters')}>
        <Icon name="character" /> Change character
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run('character')}>
        <Icon name="hide" /> {state.characterVisible ? `Hide ${name}` : `Show ${name}`}
      </button>
      <button type="button" role="menuitemcheckbox" aria-checked={state.alwaysOnTop} onClick={() => run('alwaysOnTop')}>
        <Icon name="pin" /> Keep on top <span className="switch" aria-hidden="true" />
      </button>
      <hr />
      <button type="button" role="menuitem" className="stop" onClick={() => run('stop')}>
        <Icon name="stop" /> Stop everything <kbd>{formatAccelerator(state.shortcuts.stop.accelerator, ' ')}</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => run('quit')}>
        <Icon name="quit" /> Quit {name}
      </button>
    </div>
  )
}
