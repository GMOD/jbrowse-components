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

  // Aggregation dedups on position+modType+noMod+color, but that key is
  // synthetic and never read downstream — the tooltip/widget only need the list
  // of entries per position. Single pass: dedup through one flat map and push
  // each fresh entry straight into its position's output array, so there's no
  // nested-map allocation or post-pass conversion.
  const result: Record<number, ModTooltipEntry[]> = {}
  const seen = new Map<string, ModTooltipEntry>()

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    const modKey = `${mod.position}_${mod.modType}_${mod.noMod ? 'n' : 'm'}_${mod.color}`
    let entry = seen.get(modKey)
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
      seen.set(modKey, entry)
      ;(result[mod.position] ??= []).push(entry)
    }
    entry.count++
    entry.probabilityTotal += mod.prob
    if (mod.strand === 1) {
      entry.fwd++
    } else {
      entry.rev++
    }
  }

  return result
}
