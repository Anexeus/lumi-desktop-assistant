import { Fragment } from 'react'
import { parseMarkdown, type Inline } from './markdown'

const spans = (parts: Inline[]): React.ReactNode =>
  parts.map((p, i) => (p.kind === 'code' ? <code key={i}>{p.text}</code> : p.kind === 'bold' ? <strong key={i}>{p.text}</strong> : p.text))

export function RichText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {parseMarkdown(text).map((b, i) => {
        if (b.kind === 'code') return <pre key={i}><code>{b.text}</code></pre>
        if (b.kind === 'p')
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {spans(l)}
                </Fragment>
              ))}
            </p>
          )
        const List = b.kind
        return <List key={i}>{b.items.map((item, j) => <li key={j}>{spans(item)}</li>)}</List>
      })}
    </>
  )
}
