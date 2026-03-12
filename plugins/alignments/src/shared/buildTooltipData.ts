import { getModificationName } from './modificationData.ts'
import { getColorForModification } from '../util.ts'

import type { ModificationEntry } from './webglRpcTypes.ts'
import type { ModTooltipEntry } from '../RenderPileupDataRPC/types'

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
    const posOffset = mod.position - regionStart
    let posEntry = result[posOffset]
    if (!posEntry) {
      posEntry = {}
      result[posOffset] = posEntry
    }
    const modKey = mod.modType
    let entry = posEntry[modKey]
    if (!entry) {
      entry = {
        count: 0,
        fwd: 0,
        rev: 0,
        probabilityTotal: 0,
        color: getColorForModification(mod.modType),
        name: getModificationName(mod.modType),
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
