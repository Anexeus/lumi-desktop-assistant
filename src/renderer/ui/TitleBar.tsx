import type { ReactNode } from 'react'

/** Glass title bar for frameless panels: drag to move, own minimize/close (native ones would turn Acrylic off). */
export function TitleBar({ title, children }: { title: string; children?: ReactNode }): React.JSX.Element {
  return (
    <header className="titlebar">
      <img className="titlebar-mark" src="./icon.png" alt="" />
      <h1 className="titlebar-title">{title}</h1>
      <div className="titlebar-actions">{children}</div>
      <div className="titlebar-controls">
        <button type="button" className="win-btn" aria-label="Minimize" onClick={() => void window.assistant.windowControl('minimize')}>
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button type="button" className="win-btn close" aria-label="Close" onClick={() => void window.assistant.windowControl('close')}>
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  )
}
