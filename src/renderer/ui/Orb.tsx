import './orb.css'

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'streaming' | 'controlling'

/** The Siri-style orb: colour blobs swirling in a glass sphere. It pops in when it appears and swells with the voice. */
export function Orb({ mode, level = 0 }: { mode: OrbMode; level?: number }): React.JSX.Element {
  return (
    <span className={`orb ${mode}`} style={{ '--level': level } as React.CSSProperties} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
