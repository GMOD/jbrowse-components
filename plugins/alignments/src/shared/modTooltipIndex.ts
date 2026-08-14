import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import { getModificationName } from './modificationData.ts'
import { getOrCreate } from './util.ts'

import type { ModTooltipEntry } from '../RenderAlignmentDataRPC/types.ts'
import type { ModificationEntry } from './webglRpcTypes.ts'

/**
 * Per-position modification aggregates for the coverage tooltip, as flat
 * transferable arrays plus a small label table.
 *
 * WHY IT IS NOT A `Record<number, ModTooltipEntry[]>`, which is what it was.
 * That object is built on every fetch, in the worker, over every modification
 * call in the region — and then read at exactly ONE position, when someone
 * hovers. In methylation mode a call is emitted per cytosine, so a 100kb window
 * is tens of thousands of positions carrying two or three entries apiece, each
 * an object with two freshly-built strings on it. Structured clone is priced by
 * object COUNT (the same reason `readKeys` and `readNameBlock` exist), so that
 * shape paid to allocate ~100k objects and ~200k strings in the worker and then
 * paid again to copy every one of them across the boundary, for two numbers a
 * hover would read.
 *
 * Here the whole thing is six typed arrays — transferred, not copied — over a
 * CSR-style layout: `positions` is the sorted distinct positions, `offsets`
 * says where each one's entries live, and the per-entry arrays are read by
 * index. The two strings become one `Uint8Array` of indices into a label table
 * with one string per distinct (modType, noMod, base), and the colour is kept
 * as the packed ABGR u32 it already was and formatted at hover time.
 *
 * The aggregation is identical to what it replaced, down to two things that
 * look incidental and are not:
 *
 * - `base` is NOT part of the group key, so two calls at one position agreeing
 *   on (modType, noMod, color) merge and the label comes from whichever arrived
 *   first. That is preserved by resolving the label when a group is created and
 *   never again, rather than by keying on base — which would split them.
 * - The rows within a position keep arrival order, which is the order the old
 *   `result[position]` array was pushed in and therefore the order the tooltip
 *   lists them.
 */
export interface ModTooltipIndex {
  // Distinct positions carrying at least one call, ascending, for the binary
  // search in `modTooltipEntriesAt`.
  modTooltipPositions: Uint32Array
  // CSR row pointers: position i's entries are [offsets[i], offsets[i + 1]).
  // Length is positions.length + 1.
  modTooltipOffsets: Uint32Array
  modTooltipCounts: Uint32Array
  modTooltipFwd: Uint32Array
  modTooltipRev: Uint32Array
  // Float64 rather than Float32 because the old shape accumulated `mod.prob`
  // into a plain JS number and the tooltip divides it by the count — this is
  // the same arithmetic, not a cheaper one.
  modTooltipProbTotals: Float64Array
  // Packed ABGR, formatted to `rgb(...)` on read.
  modTooltipColors: Uint32Array
  // Index into modTooltipLabels.
  modTooltipLabelIds: Uint16Array
  // One per distinct (modType, noMod, base) — a handful of strings, cloned as
  // themselves.
  modTooltipLabels: string[]
}

export function buildModTooltipIndex({
  modifications,
  regionStart,
}: {
  modifications: ModificationEntry[]
  regionStart: number
}): ModTooltipIndex | undefined {
  if (modifications.length === 0) {
    return undefined
  }

  // Groups accumulate in arrival order into plain arrays and are sorted into
  // position order once at the end; `byPosition` maps a position to its own
  // (modTypeId * 2 + noMod) -> group index table.
  const byPosition = new Map<number, Map<number, number>>()
  const modTypeIds = new Map<string, number>()
  const colorIds = new Map<number, number>()
  const labelIds = new Map<string, number>()
  const labels: string[] = []

  const groupPositions: number[] = []
  const counts: number[] = []
  const fwd: number[] = []
  const rev: number[] = []
  const probTotals: number[] = []
  const colors: number[] = []
  const groupLabels: number[] = []

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    let groups = byPosition.get(mod.position)
    if (!groups) {
      groups = new Map()
      byPosition.set(mod.position, groups)
    }
    // Numeric (allocation-free) group key, where the old builder spelled a
    // `${position}_${modType}_${noMod}_${color}` template string per call.
    // `features/modCoverage/compute.ts` interns modType the same way, and says
    // why, beside this.
    //
    // Colour is interned INTO the key rather than dropped from it, even though
    // it is derived from (modType, noMod) at all three sites that build a
    // `ModificationEntry` — so dropping it would group identically today and
    // stop doing so the moment a colour rule reads anything else. Interning
    // makes it free rather than making it a rule to remember.
    const key =
      (getOrCreate(colorIds, mod.color, () => colorIds.size) << 9) |
      (getOrCreate(modTypeIds, mod.modType, () => modTypeIds.size) << 1) |
      (mod.noMod ? 1 : 0)
    let g = groups.get(key)
    if (g === undefined) {
      g = groupPositions.length
      groups.set(key, g)
      // The no-mod bucket is "Unmodified C" (IGV's NONE_C), not "5mC"; its
      // probability is the confidence the base is unmodified.
      const labelKey = `${mod.modType}\0${mod.noMod ? 'n' : 'm'}\0${mod.base}`
      let labelId = labelIds.get(labelKey)
      if (labelId === undefined) {
        labelId = labels.length
        labelIds.set(labelKey, labelId)
        labels.push(
          mod.noMod
            ? `Unmodified ${mod.base}`
            : getModificationName(mod.modType),
        )
      }
      groupPositions.push(mod.position)
      counts.push(0)
      fwd.push(0)
      rev.push(0)
      probTotals.push(0)
      colors.push(mod.color)
      groupLabels.push(labelId)
    }
    counts[g]!++
    probTotals[g]! += mod.prob
    if (mod.strand === 1) {
      fwd[g]!++
    } else {
      rev[g]!++
    }
  }

  const positions = [...byPosition.keys()].sort((a, b) => a - b)
  const n = groupPositions.length
  const out: ModTooltipIndex = {
    modTooltipPositions: new Uint32Array(positions.length),
    modTooltipOffsets: new Uint32Array(positions.length + 1),
    modTooltipCounts: new Uint32Array(n),
    modTooltipFwd: new Uint32Array(n),
    modTooltipRev: new Uint32Array(n),
    modTooltipProbTotals: new Float64Array(n),
    modTooltipColors: new Uint32Array(n),
    modTooltipLabelIds: new Uint16Array(n),
    modTooltipLabels: labels,
  }
  let w = 0
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i]!
    out.modTooltipPositions[i] = position
    out.modTooltipOffsets[i] = w
    // Insertion order within a position, which is arrival order — the same
    // order the old `result[position]` array was pushed in, so the tooltip
    // lists its rows unchanged.
    for (const g of byPosition.get(position)!.values()) {
      out.modTooltipCounts[w] = counts[g]!
      out.modTooltipFwd[w] = fwd[g]!
      out.modTooltipRev[w] = rev[g]!
      out.modTooltipProbTotals[w] = probTotals[g]!
      out.modTooltipColors[w] = colors[g]!
      out.modTooltipLabelIds[w] = groupLabels[g]!
      w++
    }
  }
  out.modTooltipOffsets[positions.length] = w
  return out
}

// Zero-length arrays for the branch that builds no band. Allocated per call:
// collectGroupedTransferables detaches them on transfer, so a module-level
// singleton would throw DataCloneError on the second RPC reply.
export function emptyModTooltipIndex(): ModTooltipIndex {
  return {
    modTooltipPositions: new Uint32Array(0),
    modTooltipOffsets: new Uint32Array(0),
    modTooltipCounts: new Uint32Array(0),
    modTooltipFwd: new Uint32Array(0),
    modTooltipRev: new Uint32Array(0),
    modTooltipProbTotals: new Float64Array(0),
    modTooltipColors: new Uint32Array(0),
    modTooltipLabelIds: new Uint16Array(0),
    modTooltipLabels: [],
  }
}

/**
 * The tooltip rows for one genomic position, or undefined when it carries no
 * modification calls — which is what `Record[position]` answered before.
 *
 * A hover reads ONE position, so the objects the tooltip wants are built here,
 * for that position, out of the flat arrays. Binary search over the distinct
 * positions rather than a scan: the arrays are as long as the region has
 * modified columns.
 */
export function modTooltipEntriesAt(
  data: Partial<ModTooltipIndex>,
  position: number,
): ModTooltipEntry[] | undefined {
  const {
    modTooltipPositions,
    modTooltipOffsets,
    modTooltipCounts,
    modTooltipFwd,
    modTooltipRev,
    modTooltipProbTotals,
    modTooltipColors,
    modTooltipLabelIds,
    modTooltipLabels,
  } = data
  if (
    !modTooltipPositions ||
    !modTooltipOffsets ||
    !modTooltipCounts ||
    !modTooltipFwd ||
    !modTooltipRev ||
    !modTooltipProbTotals ||
    !modTooltipColors ||
    !modTooltipLabelIds ||
    !modTooltipLabels
  ) {
    return undefined
  }
  let lo = 0
  let hi = modTooltipPositions.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (modTooltipPositions[mid]! < position) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  if (
    lo >= modTooltipPositions.length ||
    modTooltipPositions[lo] !== position
  ) {
    return undefined
  }
  const from = modTooltipOffsets[lo]!
  const to = modTooltipOffsets[lo + 1]!
  const entries: ModTooltipEntry[] = []
  for (let i = from; i < to; i++) {
    const color = modTooltipColors[i]!
    entries.push({
      count: modTooltipCounts[i]!,
      fwd: modTooltipFwd[i]!,
      rev: modTooltipRev[i]!,
      probabilityTotal: modTooltipProbTotals[i]!,
      color: `rgb(${abgrRed(color)},${abgrGreen(color)},${abgrBlue(color)})`,
      name: modTooltipLabels[modTooltipLabelIds[i]!]!,
    })
  }
  return entries.length > 0 ? entries : undefined
}
