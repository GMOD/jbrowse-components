import { observer } from 'mobx-react'

import type React from 'react'

export interface NotificationsSession {
  snackbarMessages: readonly {
    message: string
    level?: string
    actions?: readonly { name: React.ReactNode; onClick: () => void }[]
  }[]
  popSnackbarMessage: () => unknown
  queueOfDialogs: readonly unknown[]
  removeActiveDialog: () => void
}

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
  padding: '4px 8px',
  fontSize: '0.8rem',
  color: 'CanvasText',
  background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
}

/**
 * Draws the two session channels a host with its own UI otherwise drops: the
 * latest of `session.snackbarMessages`, where a failed navigation, track launch
 * or config lands, and a line for each dialog JBrowse queued, which only a
 * Material host can open.
 *
 * `EmbedProvider` mounts one below its children. Pass it
 * `notifications={false}` to place this elsewhere or to draw the two queues
 * yourself.
 */
export const Notifications = observer(function Notifications({
  session,
  style,
}: {
  session: NotificationsSession
  style?: React.CSSProperties
}) {
  const latest = session.snackbarMessages.at(-1)
  const queued = session.queueOfDialogs.length
  return (
    <>
      {latest ? (
        <div
          role={latest.level === 'error' ? 'alert' : 'status'}
          data-testid="embed-notification"
          style={{ ...row, ...style }}
        >
          <span style={{ flex: 1, overflowWrap: 'anywhere' }}>
            {latest.message}
          </span>
          {latest.actions
            // 'report' opens the stack-trace dialog, which is Material
            ?.filter(action => action.name !== 'report')
            .map((action, i) => (
              <button
                // eslint-disable-next-line @eslint-react/no-array-index-key -- an action has no id, and its name may be an element
                key={i}
                type="button"
                onClick={action.onClick}
              >
                {action.name}
              </button>
            ))}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => {
              session.popSnackbarMessage()
            }}
          >
            ✕
          </button>
        </div>
      ) : null}
      {queued ? (
        <div
          role="status"
          data-testid="queued-dialog-notice"
          style={{ ...row, ...style }}
        >
          <span style={{ flex: 1 }}>
            JBrowse queued {queued} dialog{queued > 1 ? 's' : ''}, and this page
            draws none.
          </span>
          <button
            type="button"
            onClick={() => {
              session.removeActiveDialog()
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  )
})
