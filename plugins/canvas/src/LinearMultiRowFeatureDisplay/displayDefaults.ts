import { RETIRED_SHORTHAND } from './retiredSettings.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const DISPLAY_TYPE = 'LinearMultiRowFeatureDisplay'

/**
 * `displayDefaults.partitionField`, `.sampleColorMap` and `.domain` on a
 * feature track are the spellings `rows` and `rowColor` replaced. No display
 * declares them now, so the shorthand router would drop each with a console
 * warning. Moved onto an explicit multi-row entry instead, they meet that
 * display's own refusal, which names the replacement.
 */
export function routeRetiredShorthand(snap: Record<string, unknown>) {
  const written = snap.displayDefaults as Record<string, unknown> | undefined
  const retired = RETIRED_SHORTHAND.filter(key => written?.[key] !== undefined)
  if (!written || !retired.length) {
    return snap
  }
  const moved = Object.fromEntries(retired.map(key => [key, written[key]]))
  const rest = Object.fromEntries(
    Object.entries(written).filter(([key]) => !retired.includes(key)),
  )
  const displays = Array.isArray(snap.displays)
    ? (snap.displays as Record<string, unknown>[])
    : []
  const multiRow = displays.find(d => d.type === DISPLAY_TYPE)
  return {
    ...snap,
    displayDefaults: rest,
    displays: multiRow
      ? displays.map(d => (d === multiRow ? { ...d, ...moved } : d))
      : [
          ...displays,
          {
            type: DISPLAY_TYPE,
            displayId: `${snap.trackId}-${DISPLAY_TYPE}`,
            ...moved,
          },
        ],
  }
}

export default function MultiRowDisplayDefaultsF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap =>
    snap.type === 'FeatureTrack' ? routeRetiredShorthand(snap) : snap,
  )
}
