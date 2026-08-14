import { ErrorBanner } from '@jbrowse/core/ui'
import { Button } from '@mui/material'

import type { SessionLoaderModel } from '../SessionLoader.ts'
import type { CrashedSession } from '../crashedSession.ts'

/**
 * The rung between `FatalErrorDialog`'s two buttons: Refresh restores the
 * snapshot that just crashed, Reset Session escapes by discarding the user's
 * work, and this is neither. Shown instead of the session a previous boot of
 * this tab crashed on.
 *
 * Modelled on `LoaderErrorBanner`, which is the same shape one layer down — it
 * renders instead of the app, so there is no menu to reach and every way out
 * has to be a button here.
 */
export default function CrashedSessionBanner({
  crashedSession,
  loader,
}: {
  crashedSession: CrashedSession
  loader: SessionLoaderModel
}) {
  return (
    <div>
      <h1>JBrowse stopped unexpectedly</h1>
      <p style={{ margin: 20 }}>
        The last time this tab opened this session, JBrowse hit an error it
        could not recover from. Reloading opens the same session again, so it is
        being held here instead.
      </p>
      <ErrorBanner error={crashedSession.message} />
      <div style={{ margin: 20 }}>
        <Button
          variant="contained"
          data-testid="open_crashed_session"
          onClick={() => {
            void loader.openCrashedSession()
          }}
        >
          Open it anyway
        </Button>
        <Button
          variant="contained"
          style={{ marginLeft: 20 }}
          data-testid="start_fresh_session"
          onClick={() => {
            void loader.startFreshSession()
          }}
        >
          Start a new session
        </Button>
      </div>
      <p style={{ margin: 20 }}>
        Starting a new session does not delete this one. It stays in the
        autosave list (File &rarr; Recent sessions&hellip;), so you can come
        back to it, export it, or send it to us with the error above.
      </p>
    </div>
  )
}
