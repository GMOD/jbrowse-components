import { FatalErrorDialog } from '@jbrowse/core/ui'
import { Button } from '@mui/material'

import {
  globalPluginSafeMode,
  reloadInSafeMode,
} from './StartScreen/globalPlugins.ts'
import factoryReset from './factoryReset.ts'

export default function PlatformSpecificErrorDialog(props: {
  error?: unknown
}) {
  return (
    <FatalErrorDialog
      {...props}
      onFactoryReset={factoryReset}
      // A global plugin loads into every session, so one that throws leaves the
      // user here with no way back to the start screen that could uninstall it.
      // Offer the narrow recovery ahead of the factory reset, which costs them
      // every session they have.
      extraActions={
        globalPluginSafeMode() ? null : (
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              reloadInSafeMode()
            }}
          >
            Reload without global plugins
          </Button>
        )
      }
    />
  )
}
