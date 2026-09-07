import { SettingsChangesTable } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  displayDefaultChanges,
  resetDisplayDefault,
} from './displayDefaultChanges.ts'

import type { DisplayDefaultsSession } from './displayDefaultChanges.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export type { DisplayDefaultsSession } from './displayDefaultChanges.ts'

/**
 * The inventory of session-wide display-type defaults: every value the user has
 * pinned from a track menu, what it overrides, and a button to clear one.
 *
 * The pin is easy to set and, until this, hard to find again. A pinned default
 * shows on the track-selector badge of any **open** track it moves — but one
 * affecting nothing currently open, and one that no longer resolves at all (a
 * stale value the cascade refuses, or a display type whose plugin is gone)
 * appear nowhere. The only place that listed them was the "Reset preferences to
 * defaults" confirmation, which is a destructive dialog to have to open in
 * order to read something.
 *
 * The empty state is deliberate rather than rendering nothing: it is the one
 * place the app says the capability exists to someone who has never used it.
 */
const DisplayDefaultsSection = observer(function DisplayDefaultsSection({
  session,
  pluginManager,
}: {
  session: DisplayDefaultsSession
  pluginManager: PluginManager
}) {
  const changes = displayDefaultChanges(session, pluginManager)
  return changes.length ? (
    <>
      <Typography>
        These apply to every track of a display type that hasn't set its own
        value. Clear one to put those tracks back on the setting's default.
      </Typography>
      <SettingsChangesTable
        changes={changes}
        onResetRow={change => {
          resetDisplayDefault(session, change)
        }}
      />
    </>
  ) : (
    <Typography>
      None set. The pin beside a setting in a track menu applies that value to
      every open track of the same display type, and then offers to keep it as
      the default for the ones you open later.
    </Typography>
  )
})

export default DisplayDefaultsSection
