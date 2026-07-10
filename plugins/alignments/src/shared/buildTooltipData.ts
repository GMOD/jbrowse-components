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

  const result: Record<number, Record<string, ModTooltipEntry>> = {}

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    let posEntry = result[mod.position]
    if (!posEntry) {
      posEntry = {}
      result[mod.position] = posEntry
    }
    const modKey = `${mod.modType}_${mod.noMod ? 'nomod' : 'mod'}_${mod.color}`
    let entry = posEntry[modKey]
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
      posEntry[modKey] = entry
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
