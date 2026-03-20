import { getSnapshot, type IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Produces a track config snapshot where the given display's session overrides
 * are baked into the matching display config entry. For each config slot on
 * the display config, compares the stored config value against the display
 * model's getter value. When they differ, the getter value is used.
 *
 * Display types call this from their `getEffectiveTrackConfig()` view.
 */
export function getEffectiveTrackConfig(
  trackConfig: IAnyStateTreeNode,
  display: {
    configuration: Record<string, unknown>
    [key: string]: unknown
  },
) {
  const conf = getSnapshot(trackConfig) as Record<string, unknown>

  const displays = conf.displays as Record<string, unknown>[] | undefined
  if (!Array.isArray(displays)) {
    return conf
  }

  const displayConf = display.configuration
  const displayConfId = getDisplayId(displayConf)

  return {
    ...conf,
    displays: displays.map(d =>
      d.displayId !== displayConfId
        ? d
        : { ...d, ...getDisplayOverrides(displayConf, display) },
    ),
  }
}

function getDisplayId(displayConf: Record<string, unknown>) {
  const slot = displayConf.displayId
  if (slot && typeof slot === 'object' && 'getValue' in slot) {
    return (slot as { getValue: () => unknown }).getValue()
  }
  return displayConf.displayId
}

function getSlotValue(slot: unknown) {
  if (slot && typeof slot === 'object' && 'getValue' in slot) {
    return (slot as { getValue: () => unknown }).getValue()
  }
  return undefined
}

function getDisplayOverrides(
  displayConf: Record<string, unknown>,
  display: Record<string, unknown>,
) {
  const overrides: Record<string, unknown> = {}
  for (const key of Object.keys(displayConf)) {
    if (key === 'type' || key === 'displayId') {
      continue
    }
    const configValue = getSlotValue(displayConf[key])
    if (configValue === undefined) {
      continue
    }
    const displayValue = display[key]
    if (displayValue !== undefined && displayValue !== configValue) {
      overrides[key] = displayValue
    }
  }
  return overrides
}
