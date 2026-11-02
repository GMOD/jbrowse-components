import { getType } from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaMetadata } from '../configuration/schemaRegistry.ts'
import { isConfigurationModel } from '../configuration/schemaTypes.ts'
import { misnamedPointer } from '../configuration/snapshotPreprocess.ts'
import { getNotificationSink } from './sessionServices.ts'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/** what a diagnostic calls the view: its snapshot `type`, or the model name */
export function viewLabel(self: IStateTreeNode) {
  return (self as IStateTreeNode & { type?: string }).type ?? getType(self).name
}

/**
 * What every surface calls this mistake. A session spec launches a view without
 * ever building a snapshot, so it classifies its own keys and reports them
 * through its own session rather than through the sink below — one wording, so
 * a typo reads the same whether it was written in a config or in a URL.
 */
export function unknownKeysMessage(label: string, keys: string[]) {
  return `${label} ignored unknown key(s): ${keys.join(', ')}`
}

/** Why a settings key `applyDisplaySettings` was handed wrote nothing. */
export type UnappliedReason =
  // nothing on the display takes this key, misspellings included
  | 'no-slot'
  // not a config slot, but a `set<Key>` action exists
  | 'setter-only'
  // `type` picks which display to build; it is not a setting
  | 'display-type'

export interface UnappliedSetting {
  key: string
  reason: UnappliedReason
}

/** The action `setter-only` names: `height` -> `setHeight`. */
export function displaySetterName(key: string) {
  return `set${key[0]!.toUpperCase()}${key.slice(1)}`
}

/**
 * What a surface calls a key the display has an action for but no slot. Its own
 * sentence rather than `unknownKeysMessage`'s: the display does take the
 * setting, just not written this way, and saying "unknown key" over a key whose
 * setter we name in the same breath contradicts itself.
 */
export function setterOnlyMessage(label: string, keys: string[]) {
  return `${label} did not apply ${keys.join(', ')}: no config slot takes ${
    keys.length > 1 ? 'them' : 'it'
  }. Call ${keys.map(displaySetterName).join(', ')} on the display instead.`
}

/** The `misnamed` words of a display's config schema. */
export function displayMisnamed(display: unknown) {
  return typeof display === 'object' &&
    display !== null &&
    'configuration' in display &&
    isConfigurationModel(display.configuration)
    ? (getConfigurationSchemaMetadata(display.configuration)?.options
        .misnamed ?? {})
    : {}
}

/**
 * What a surface says of the settings a display did not apply: a word its
 * schema calls `misnamed` points at the path to write, ahead of a setter the
 * display also has, then the setter-only keys, then the rest.
 */
export function unappliedSettingsMessages(
  label: string,
  unapplied: UnappliedSetting[],
  misnamed: Readonly<Record<string, string>>,
) {
  const keys = (of: UnappliedSetting[]) => of.map(entry => entry.key)
  const pointed = unapplied.filter(e => Object.hasOwn(misnamed, e.key))
  const rest = unapplied.filter(e => !Object.hasOwn(misnamed, e.key))
  const setterOnly = rest.filter(e => e.reason === 'setter-only')
  const unknown = rest.filter(e => e.reason !== 'setter-only')
  return [
    ...(pointed.length
      ? [
          `${label} did not apply ${keys(pointed).join(', ')}: no config slot takes ${
            pointed.length > 1 ? 'them' : 'it'
          }${misnamedPointer(misnamed, keys(pointed))}`,
        ]
      : []),
    ...(unknown.length ? [unknownKeysMessage(label, keys(unknown))] : []),
    ...(setterOnly.length ? [setterOnlyMessage(label, keys(setterOnly))] : []),
  ]
}

/**
 * Name the keys a view was handed and could not place, from the partition
 * `withLaunchInput` runs on the snapshot. The console alone, like
 * `reportLegacyInit`: the view opened without them, and the keys are usually a
 * v4 session's retired state that a visitor holding the link cannot act on.
 */
export function reportUnknownKeys(self: IStateTreeNode, keys: string[]) {
  if (keys.length) {
    console.warn(unknownKeysMessage(viewLabel(self), keys))
  }
}

/**
 * Name the row lists a view refused whole. `withLaunchInput` splits an authored
 * array into the recipes a launcher resolves and the built snapshots MST
 * restores, per entry — but a row list is indexed against the view's `levels`
 * and per-level tracks, so a list holding both kinds has no correct split and
 * is refused rather than renumbered.
 */
export function reportMalformedRows(self: IStateTreeNode, keys: string[]) {
  if (!keys.length) {
    return
  }
  const message = `${viewLabel(self)} refused ${keys.join(', ')}: the list mixes built view snapshots with recipes to open one, and the rows index against the levels between them. Write all of them one way.`
  console.warn(message)
  try {
    getNotificationSink(self).notify(message, 'warning')
  } catch {
    // a view built outside a session has nowhere to put it
  }
}

/**
 * What every surface calls v4's nested `init`. v5 takes every setting directly
 * on the view object and unwraps the nesting on the way in, so the settings
 * still arrive — this names the spelling to fix while they do.
 */
export function legacyInitMessage(label: string) {
  return `${label} nests its settings under "init", which is deprecated: write every setting directly on the view object.`
}

/**
 * Name a snapshot that still writes v4's nested `init`. The console alone,
 * unlike the two reporters above: the settings were applied, so there is
 * nothing for a visitor to act on and a warning toast over a working view is
 * noise. `jbrowse validate` is where the author of the config hears about it.
 */
export function reportLegacyInit(self: IStateTreeNode) {
  console.warn(legacyInitMessage(viewLabel(self)))
}
