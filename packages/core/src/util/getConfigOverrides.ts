import { readConfObject } from '../configuration/index.ts'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '../configuration/index.ts'

/**
 * Produces a track config snapshot where the given display's session overrides
 * are baked into the matching display config entry. For each config slot on
 * the display, compares the stored config value against the display model's
 * getter value. When they differ, the getter value is used.
 *
 * Display types call this from their `getEffectiveTrackConfig()` view.
 */
export function getEffectiveTrackConfig(
  trackConfig: AnyConfigurationModel,
  display: {
    configuration: AnyConfigurationModel
    [key: string]: unknown
  },
) {
  const conf = getSnapshot(trackConfig) as Record<string, unknown>
  const displayConf = display.configuration
  const displayConfId = readConfObject(displayConf, 'displayId' as never)

  const displays = conf.displays as Record<string, unknown>[] | undefined
  if (!Array.isArray(displays)) {
    return conf
  }

  return {
    ...conf,
    displays: displays.map(d =>
      d.displayId !== displayConfId
        ? d
        : {
            ...d,
            ...getDisplayOverrides(displayConf, display),
          },
    ),
  }
}

function getDisplayOverrides(
  displayConf: AnyConfigurationModel,
  display: Record<string, unknown>,
) {
  const overrides: Record<string, unknown> = {}
  for (const key of Object.keys(displayConf)) {
    if (key === 'type' || key === 'displayId') {
      continue
    }
    const slot = displayConf[key]
    if (!slot || typeof slot !== 'object' || !('getValue' in slot)) {
      continue
    }
    const configValue = readConfObject(displayConf, key as never)
    const displayValue = display[key]
    if (displayValue !== undefined && displayValue !== configValue) {
      overrides[key] = displayValue
    }
  }
  return overrides
}
