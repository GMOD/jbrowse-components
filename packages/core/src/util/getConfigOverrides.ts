import { getSnapshot, type IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import { toJS } from 'mobx'

interface ConfigSlot {
  value: unknown
  isCallback?: boolean
  getValue: (args?: Record<string, unknown>) => unknown
}

function isConfigSlot(slot: unknown): slot is ConfigSlot {
  return (
    !!slot &&
    typeof slot === 'object' &&
    'getValue' in slot &&
    typeof (slot as ConfigSlot).getValue === 'function'
  )
}

function readSlotValue(slot: ConfigSlot) {
  return slot.isCallback ? slot.value : slot.getValue()
}

/**
 * Produces a track config snapshot where the given display's session overrides
 * are baked into the matching display config entry. For each non-callback
 * config slot on the display, compares the config value against the display
 * model's getter. When they differ, the getter value is used.
 *
 * Display types use this from their `effectiveTrackConfig` getter.
 */
export function getEffectiveTrackConfig(
  trackConfig: IAnyStateTreeNode,
  display: {
    configuration: Record<string, unknown>
    [key: string]: unknown
  },
) {
  const conf = getSnapshot(trackConfig) as Record<string, unknown>

  const trackDisplays = (trackConfig as Record<string, unknown>)
    .displays as Record<string, unknown>[] | undefined
  if (!Array.isArray(trackDisplays)) {
    return conf
  }

  // displayId is a types.identifier that postProcessSnapshot strips, so
  // the only reliable source is the display model snapshot's configuration
  // reference value
  const displaySnap = getSnapshot(
    display as unknown as IAnyStateTreeNode,
  ) as Record<string, unknown>
  const displayConfId = displaySnap.configuration as string | undefined

  const displayType = display.configuration.type as string | undefined

  return {
    ...conf,
    displays: trackDisplays.map(d => {
      const dConf = d as Record<string, unknown>
      if (dConf.type === displayType) {
        return buildDisplayEntry(displayConfId, dConf, display)
      }
      return buildDisplayEntry(undefined, dConf, {})
    }),
  }
}

function buildDisplayEntry(
  displayId: string | undefined,
  displayConf: Record<string, unknown>,
  display: Record<string, unknown>,
) {
  const entry: Record<string, unknown> = {}
  if (displayId) {
    entry.displayId = displayId
  }
  for (const key of Object.keys(displayConf)) {
    const slot = displayConf[key]
    if (!isConfigSlot(slot)) {
      // Include plain properties like type
      if (typeof slot === 'string' || typeof slot === 'number') {
        entry[key] = slot
      }
      continue
    }
    // Skip jexl callback slots — they require runtime context (e.g. feature)
    if (slot.isCallback) {
      continue
    }
    const configValue = readSlotValue(slot)
    const displayValue = toJS(display[key])
    if (displayValue !== undefined && displayValue !== configValue) {
      entry[key] = displayValue
    }
  }
  return entry
}
