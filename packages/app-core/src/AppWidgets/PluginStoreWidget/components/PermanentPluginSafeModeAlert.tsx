import { Alert, Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithPermanentPlugins } from '@jbrowse/core/util/types'

// Safe mode is otherwise silent: the app comes up looking normal, missing
// whatever those plugins provide. Said here as well as in the boot notification
// because this is where the switches are — a notification a user has dismissed,
// or arrives too late to read, leaves them with a JBrowse that quietly lost its
// plugins.
//
// Shown for a list with everything switched off too, since the reload button is
// the only way back out of safe mode.
const PermanentPluginSafeModeAlert = observer(
  function PermanentPluginSafeModeAlert({
    session,
  }: {
    session: SessionWithPermanentPlugins
  }) {
    const safeMode = session.permanentPluginsSafeMode
    return safeMode && session.permanentPlugins.length > 0 ? (
      <Alert
        severity="warning"
        action={
          <Button
            onClick={() => {
              session.reloadWithPermanentPlugins()
            }}
          >
            Turn back on and reload
          </Button>
        }
      >
        {safeMode.reason === 'previousLaunchFailed'
          ? `The plugins kept for this JBrowse were skipped because the last load did not finish.${
              safeMode.suspects.length
                ? ` Loading: ${safeMode.suspects.join(', ')}.`
                : ''
            } Switch off whichever one you suspect, then turn them back on.`
          : 'The plugins kept for this JBrowse are skipped because this URL asks for safe mode.'}
      </Alert>
    ) : null
  },
)

export default PermanentPluginSafeModeAlert
