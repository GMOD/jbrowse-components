import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'
import { SettingsChangesTable } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { TrackConfigChange } from '@jbrowse/core/util'

export interface DisplayDefaultsSession {
  getDisplayTypeDefaults: () => {
    displayType: string
    slot: string
    value: unknown
  }[]
  setDisplayTypeDefault: (
    displayType: string,
    slot: string,
    value: unknown,
  ) => void
}

// The registered display types, by name.
//
// **Built rather than reached through `getDisplayType`, which THROWS** on a name
// no plugin registers — an optional chain over it guards nothing. A default left
// behind by a plugin that has since been uninstalled is exactly a row this
// section has to render, so reaching for that getter would crash the whole
// Preferences dialog for the one user whose pins most need clearing.
function displayTypesByName(pluginManager: PluginManager) {
  return new Map(pluginManager.getDisplayElements().map(d => [d.name, d]))
}

// What a track sitting at the bottom of the cascade shows for this slot — the
// value clearing the pin would restore. Read off the display type's schema
// rather than off the session, which holds only what was promoted. Undefined
// for a display type that is gone, whose row then reads "(default)" like any
// other unknown.
function promotedBaseOf(
  configSchema: AnyConfigurationSchemaType | undefined,
  slot: string,
) {
  const def = configSchema
    ? getConfigurationSchemaDefinition(configSchema)?.[slot]
    : undefined
  return isSlotDefinitionEntry(def) ? def.promotedBase : undefined
}

/**
 * The inventory of session-wide display-type defaults: every value the user has
 * pinned from a track menu, what it overrides, and a button to clear one.
 *
 * The pin is easy to set and, until this, hard to find again. A pinned default
 * shows on the track-selector badge of any **open** track it moves — but one
 * affecting nothing currently open, one promoted to a value equal to the slot's
 * base, and one that no longer resolves at all (a stale value the cascade
 * refuses, or a display type whose plugin is gone) appear nowhere. The only
 * place that listed them was the "Reset preferences to defaults" confirmation,
 * which is a destructive dialog to have to open in order to read something.
 *
 * The empty state is deliberate rather than rendering nothing: it is the one
 * place the app says the capability exists to someone who has never used it.
 *
 * **The slot keeps its schema name**, while the display type gets its authored
 * one. A slot has no menu label to borrow — which row a setting is offered on is
 * a menu fact and declaring the slot promotable is a schema fact, and nothing
 * joins them (that split is why `promotableSlotsWithoutPin` has to walk a built
 * menu at all). A raw slot name is also what the config editor labels its fields
 * with, so the two surfaces agree.
 */
const DisplayDefaultsSection = observer(function DisplayDefaultsSection({
  session,
  pluginManager,
}: {
  session: DisplayDefaultsSession
  pluginManager: PluginManager
}) {
  const byName = displayTypesByName(pluginManager)
  const changes = session
    .getDisplayTypeDefaults()
    .map(({ displayType, slot, value }): TrackConfigChange => ({
      // the address this section's own reset uses, so it depends on nothing the
      // session's preference-key layout does
      path: [displayType, slot],
      label: `${byName.get(displayType)?.displayName ?? displayType} › ${slot}`,
      from: promotedBaseOf(
        byName.get(displayType)?.configSchema,
        slot,
      ) as TrackConfigChange['from'],
      to: value as TrackConfigChange['to'],
    }))
  return changes.length ? (
    <>
      <Typography>
        These apply to every track of a display type that hasn't set its own
        value. Clear one to put those tracks back on the setting's default.
      </Typography>
      <SettingsChangesTable
        changes={changes}
        onResetRow={change => {
          session.setDisplayTypeDefault(
            change.path[0]!,
            change.path[1]!,
            undefined,
          )
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
