import { type IAnyStateTreeNode, getSnapshot } from '@jbrowse/mobx-state-tree'
import deepEqual from 'fast-deep-equal'
import { toJS } from 'mobx'

import { isCallbackValue } from '../configuration/slotValueUtils.ts'

/**
 * Produces a track config snapshot suitable for "Copy config". Merges the active
 * display's runtime overrides (ConfigOverrideMixin's `configOverrides` map) onto
 * the matching display's config, keeping only overrides that differ from the
 * config value. jexl-callback config slots are skipped (the override would be
 * compared against an unevaluated string).
 *
 * Matching is by display type string: the live config node reached via
 * `trackConfig.displays` is a different MST proxy than `display.configuration`,
 * so identity comparison fails.
 */
export function getEffectiveTrackConfig(
  trackConfig: IAnyStateTreeNode,
  display: IAnyStateTreeNode,
): Record<string, unknown> {
  const conf: Record<string, unknown> = getSnapshot(trackConfig)

  const trackDisplays = (trackConfig as { displays?: unknown }).displays as
    | ({ type?: string } & Record<string, unknown>)[]
    | undefined
  if (!Array.isArray(trackDisplays)) {
    return conf
  }

  const activeConf = (
    display as { configuration?: { type?: string; displayId?: string } }
  ).configuration
  const displayType = activeConf?.type
  const displayId = activeConf?.displayId
  const overrides =
    (display as { configOverrides?: Record<string, unknown> })
      .configOverrides ?? {}

  return {
    ...conf,
    displays: trackDisplays.map(d =>
      d.type === displayType
        ? buildDisplayEntry(displayId, d, overrides)
        : buildDisplayEntry(undefined, d, {}),
    ),
  }
}

function buildDisplayEntry(
  displayId: string | undefined,
  displayConf: { type?: string } & Record<string, unknown>,
  overrides: Record<string, unknown>,
) {
  const entry: Record<string, unknown> = {}
  if (displayId) {
    entry.displayId = displayId
  }
  if (typeof displayConf.type === 'string') {
    entry.type = displayConf.type
  }
  for (const [key, value] of Object.entries(overrides)) {
    const overrideValue = toJS(value)
    const configValue = displayConf[key]
    // deepEqual (not ===) so object/array slots (colorBy, filterBy, sortedBy)
    // that toJS-clone to a fresh reference are still recognized as equal to the
    // config default and omitted from the copied config.
    if (
      overrideValue !== undefined &&
      !deepEqual(overrideValue, configValue) &&
      !isCallbackValue(configValue)
    ) {
      entry[key] = overrideValue
    }
  }
  return entry
}
