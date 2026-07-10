import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import { getModificationName } from './modificationData.ts'

import type { ModificationEntry } from './webglRpcTypes.ts'
import type { ModTooltipEntry } from '../RenderAlignmentDataRPC/types'

export function buildModTooltipData({
  modifications,
  regionStart,
}: {
  modifications: ModificationEntry[]
  regionStart: number
}) {
  if (modifications.length === 0) {
    return undefined
  }

  // Per-position dedup during aggregation is keyed on modType+noMod+color, but
  // that key is synthetic and never read downstream — the tooltip/widget only
  // need the list of aggregated entries. So aggregate through Maps and emit a
  // plain array per position.
  const byPosition = new Map<number, Map<string, ModTooltipEntry>>()

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    let posEntry = byPosition.get(mod.position)
    if (!posEntry) {
      posEntry = new Map()
      byPosition.set(mod.position, posEntry)
    }
    const modKey = `${mod.modType}_${mod.noMod ? 'nomod' : 'mod'}_${mod.color}`
    let entry = posEntry.get(modKey)
    if (!entry) {
      entry = {
        count: 0,
        fwd: 0,
        rev: 0,
        probabilityTotal: 0,
        color: `rgb(${abgrRed(mod.color)},${abgrGreen(mod.color)},${abgrBlue(mod.color)})`,
        // The no-mod bucket is "Unmodified C" (IGV's NONE_C), not "5mC"; its
        // probability is the confidence the base is unmodified.
        name: mod.noMod
          ? `Unmodified ${mod.base}`
          : getModificationName(mod.modType),
      }
      posEntry.set(modKey, entry)
    }
    entry.count++
    entry.probabilityTotal += mod.prob
    if (mod.strand === 1) {
      entry.fwd++
    } else {
      entry.rev++
    }
  }

  const result: Record<number, ModTooltipEntry[]> = {}
  for (const [position, posEntry] of byPosition) {
    result[position] = [...posEntry.values()]
  }
  return result
}
