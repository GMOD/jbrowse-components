import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'

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

// Head of the path a promoted default's row carries, so `resetDisplayDefault`
// can tell it from a scalar preference row in the same table. Module-private:
// the one producer and the one consumer of the shape are both here, which is
// what lets the session know nothing about how the Preferences dialog
// addresses a row.
const DISPLAY_DEFAULT_PATH_HEAD = 'displayTypeDefaults'

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
 * Every promoted display-type default as a settings row: what it overrides
 * (the slot's `promotedBase`), the value, and a label naming the display type
 * the way the user knows it. One builder for the two surfaces that list them,
 * the Display defaults section and the "Reset to defaults" confirmation, which
 * used to render the same default two ways.
 *
 * **The slot keeps its schema name**, while the display type gets its authored
 * one. A slot has no menu label to borrow — which row a setting is offered on is
 * a menu fact and declaring the slot promotable is a schema fact, and nothing
 * joins them (that split is why `promotableSlotsWithoutPin` has to walk a built
 * menu at all). A raw slot name is also what the config editor labels its fields
 * with, so the two surfaces agree.
 */
export function displayDefaultChanges(
  session: DisplayDefaultsSession,
  pluginManager: PluginManager,
): TrackConfigChange[] {
  const byName = displayTypesByName(pluginManager)
  return session
    .getDisplayTypeDefaults()
    .map(({ displayType, slot, value }): TrackConfigChange => ({
      path: [DISPLAY_DEFAULT_PATH_HEAD, displayType, slot],
      label: `${byName.get(displayType)?.displayName ?? displayType} › ${slot}`,
      from: promotedBaseOf(
        byName.get(displayType)?.configSchema,
        slot,
      ) as TrackConfigChange['from'],
      to: value as TrackConfigChange['to'],
    }))
}

/**
 * Clear the promoted default a row built by {@link displayDefaultChanges}
 * stands for. Returns false for any other row, so a table mixing both kinds
 * can hand every reset here first.
 */
export function resetDisplayDefault(
  session: DisplayDefaultsSession,
  change: TrackConfigChange,
) {
  const [head, displayType, slot] = change.path
  const isDisplayDefault =
    head === DISPLAY_DEFAULT_PATH_HEAD && !!displayType && !!slot
  if (isDisplayDefault) {
    session.setDisplayTypeDefault(displayType, slot, undefined)
  }
  return isDisplayDefault
}
