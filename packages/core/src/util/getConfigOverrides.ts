import { type IAnyStateTreeNode, getSnapshot } from '@jbrowse/mobx-state-tree'
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

// For non-callback slots, getValue() resolves the value (same as
// readConfObject internally). For callback slots we return the raw
// jexl expression string since it can't be evaluated without a feature.
function readSlotValue(slot: ConfigSlot) {
  return slot.isCallback ? slot.value : slot.getValue()
}

/**
 * Produces a track config snapshot suitable for "Copy config". For each
 * non-callback config slot on the active display, compares the config default
 * against the display model's current value. Only values that differ from
 * defaults are included (matching readConfObject's behavior).
 *
 * Key design decisions:
 * - We read live display config models (trackConfig.displays) rather than
 *   getSnapshot(trackConfig).displays, because MST's postProcessSnapshot
 *   strips display configs to {} when all values are defaults.
 * - displayId is a types.identifier that postProcessSnapshot also strips,
 *   so we recover it from getSnapshot(display).configuration which stores
 *   the reference as a plain string.
 * - Matching is by display type string since the live config model accessed
 *   via trackConfig.displays is a different MST proxy than
 *   display.configuration (identity check fails).
 */
export function getEffectiveTrackConfig(
  trackConfig: IAnyStateTreeNode,
  display: {
    configuration: Record<string, unknown>
    [key: string]: unknown
  },
): Record<string, unknown> {
  const conf = getSnapshot(trackConfig) as Record<string, unknown>

  const trackDisplays = (trackConfig as Record<string, unknown>).displays as
    | Record<string, unknown>[]
    | undefined
  if (!Array.isArray(trackDisplays)) {
    return conf
  }

  const displaySnap = getSnapshot(display as unknown as IAnyStateTreeNode) as Record<string, unknown>
  const displayConfId = displaySnap.configuration as string | undefined
  const displayType = display.configuration.type as string | undefined

  return {
    ...conf,
    displays: trackDisplays.map(d => {
      const dConf = d
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
