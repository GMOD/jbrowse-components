import { withAbgrAlpha } from '@jbrowse/core/util/colorBits'

import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'

// `modificationTypes` is derived from the marks, not from the MM/ML parse's
// `detectedModifications` (which the modifications menu owns). The two diverge
// on bisulfite: no tags, so that set is empty while every mark carries 'm'.
export function buildModificationArrays(
  modifications: ModificationEntry[],
  regionStart: number,
) {
  // Counted, not `modifications.filter(...)`. This is the densest array the
  // display produces — one mark per CpG per read on a nanopore pileup — and the
  // filter allocated a second full-length array of pointers to walk once and
  // drop. Two passes over the same array cost a compare each; the copy cost a
  // machine word per mark.
  const n = modifications.length
  let kept = 0
  for (let i = 0; i < n; i++) {
    if (modifications[i]!.position >= regionStart) {
      kept++
    }
  }
  const modificationPositions = new Uint32Array(kept)
  // Pre-pack each modification's RGB + probability-as-alpha into ABGR u32 so
  // both the GPU vertex buffer and the Canvas2D shader path can read one
  // slot instead of four shifted bytes.
  const modificationColors = new Uint32Array(kept)
  const modificationProbabilities = new Uint8Array(kept)
  const modificationReadIndices = new Uint32Array(kept)
  const modificationTypeIndices = new Uint8Array(kept)
  // The no-mod bucket flag (1 = this call says the base is UNmodified). Carried
  // alongside the type index because `modType` stays the canonical mod code for
  // both buckets, so type alone can't tell them apart — without this the hit
  // test labeled a blue unmodified mark with the mod's own name.
  const modificationNoMod = new Uint8Array(kept)
  const modificationTypes: string[] = []
  const modTypeToIdx = new Map<string, number>()
  let w = 0
  for (let i = 0; i < n; i++) {
    const m = modifications[i]!
    if (m.position < regionStart) {
      continue
    }
    modificationPositions[w] = m.position
    // Quadratic curve with 0.1 floor: low-prob mods stay faintly visible,
    // high-prob mods are strongly opaque (matches main branch alphaColor).
    const a = Math.round(Math.min(1, m.prob * m.prob + 0.1) * 255) & 0xff
    modificationColors[w] = withAbgrAlpha(m.color, a)
    modificationProbabilities[w] = Math.round(m.prob * 255) & 0xff
    modificationReadIndices[w] = m.readIndex
    let typeIdx = modTypeToIdx.get(m.modType)
    if (typeIdx === undefined) {
      typeIdx = modificationTypes.length
      modTypeToIdx.set(m.modType, typeIdx)
      modificationTypes.push(m.modType)
    }
    modificationTypeIndices[w] = typeIdx
    modificationNoMod[w] = m.noMod ? 1 : 0
    w++
  }
  return {
    modificationPositions,
    modificationColors,
    modificationProbabilities,
    modificationReadIndices,
    modificationTypeIndices,
    modificationNoMod,
    modificationTypes,
  }
}
