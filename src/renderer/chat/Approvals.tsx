import type { ApprovalRequest } from '@shared/ipc'

/** Actions waiting for the user's OK. Nothing happens until one of these buttons is pressed (no answer in 2 min = no). */
export function Approvals({ requests }: { requests: ApprovalRequest[] }): React.JSX.Element | null {
  if (!requests.length) return null
  return (
    <section className="approvals" aria-label="Actions waiting for your OK">
      {requests.map((r) => (
        <div key={r.id} className="approval" role="alertdialog" aria-labelledby={`approval-${r.id}`}>
          <p id={`approval-${r.id}`} className="approval-title">
            <span aria-hidden="true">⚑</span> {r.title}?
          </p>
          <pre className="approval-detail">{r.detail}</pre>
          <div className="approval-actions">
            <button type="button" onClick={() => void window.assistant.approve(r.id, 'once')} autoFocus>
              Allow once
            </button>
            <button type="button" className="secondary" onClick={() => void window.assistant.approve(r.id, 'chat')}>
              Allow for this chat
            </button>
            <button type="button" className="secondary" onClick={() => void window.assistant.approve(r.id, 'deny')}>
              Deny
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
