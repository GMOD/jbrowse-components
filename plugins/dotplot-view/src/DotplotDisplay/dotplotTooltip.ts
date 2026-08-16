import { assembleLocString } from '@jbrowse/core/util'
import {
  comparativeTooltipLines,
  featureAttributes,
} from '@jbrowse/synteny-core'

import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotRpcData } from './types.ts'
import type { ComparativeTooltipSide } from '@jbrowse/synteny-core'

// One axis' span of a feature, from the two absolute cumBp endpoints the
// geometry was built from.
//
// It goes through `pxToBp` rather than reading `refNameDict[refNameIds[i]]`,
// which looks like the direct answer and is the wrong namespace: the dictionary
// holds the names the ADAPTER used (the worker only ever sees regions put
// through `renameRegionsIfNeeded`), while the axis holds the assembly's
// canonical names. On an aliased track — a PAF naming `1` against an assembly
// canonicalized `chr1` — the dictionary would print the file's spelling at the
// user. Same rule as everywhere else: read the name off the region.
//
// `pxToBp` is also what applies the reversed-region reflection, which both
// dotplot axes routinely carry — auto-diagonalize flips query regions on the
// vertical axis.
//
// Both endpoints land in the same displayed region by construction
// (`clampBlockToRegions` trimmed the block to one region entry before
// projecting), so one end's refName names the whole span. An endpoint sitting
// exactly on a region boundary resolves into the neighbour, which still leaves
// the coordinate at the boundary — hence no out-of-bounds arm here.
//
// The coordinate is ROUNDED off `offset` rather than taken from `coord0`, which
// floors. A feature endpoint is an exact integer bp, and the trip out to px and
// back (`cumBp/bpPerPx` then `(offsetPx + px)*bpPerPx` inside pxToBp) lands a
// hair either side of it — a relative error of ~1e-16, but the floor turns half
// of those into an off-by-one, and which half depends on the current zoom. So
// the same alignment read `y len: 593` at whole-genome zoom and `592` zoomed in;
// `browser-tests/dotplot-hover-probe.ts` is what showed the two side by side.
// Rounding recovers the integer because the error is nowhere near 0.5.
// `coord0`'s floor is right for what it is for — naming the base under a pixel,
// including pixels off the end of the region — and wrong for reading back a
// coordinate that was exact on the way in.
//
// `assembleLocString`, the same 1-based spelling the synteny tooltip and every
// other coordinate in the app use — not a hand-rolled `refName:start-end`,
// which printed the interbase start and so read one lower than both the axis
// ruler beside it and the nav box a user pastes it into. Its fields are named
// explicitly rather than spread from the `pxToBp` result, which carries the
// region's `reversed` and would append a `[rev]` describing the axis rather
// than the alignment.
function axisSpan(
  label: string,
  cumBpA: number,
  cumBpB: number,
  view: Dotplot1DViewModel,
): ComparativeTooltipSide {
  const { bpPerPx, offsetPx } = view
  const at = (cumBp: number) => {
    const r = view.pxToBp(cumBp / bpPerPx - offsetPx)
    return {
      assemblyName: r.assemblyName,
      refName: r.refName,
      coord: Math.round(r.reversed ? r.end - r.offset : r.start + r.offset),
    }
  }
  const a = at(cumBpA)
  const b = at(cumBpB)
  const start = Math.min(a.coord, b.coord)
  const end = Math.max(a.coord, b.coord)
  return {
    label,
    loc: assembleLocString({
      assemblyName: a.assemblyName,
      refName: a.refName,
      start,
      end,
    }),
    length: end - start,
  }
}

/**
 * The hover tooltip for one dotplot feature, as lines.
 *
 * The shape — two locations, inverted, two lengths, the numeric channels, the
 * CIGAR operator, the name — comes off `comparativeTooltipLines`, shared with
 * the synteny display so the pair cannot drift again. All this side decides is
 * that its two sides are called x and y.
 *
 * The two spans are the DRAWN ones (the trimmed cumBp endpoints), not
 * `alignmentLengths` — that is the feature's full reference span, which on a
 * block trimmed to the displayed region disagrees with the locations printed
 * right above it.
 */
export function getDotplotTooltipLines({
  rpcData,
  featureIdx,
  hview,
  vview,
  cigarOp,
}: {
  rpcData: DotplotRpcData
  featureIdx: number
  hview: Dotplot1DViewModel
  vview: Dotplot1DViewModel
  // The operator under the cursor, resolved from the hovered SEGMENT rather than
  // the feature — see `segmentCigarOp`. Undefined for most segments and every
  // zoomed-out one.
  cigarOp?: { op: string; length: number }
}) {
  const { p11, p12, p21, p22, strands, attributes, nameDict, nameIds } = rpcData
  return comparativeTooltipLines({
    sides: [
      axisSpan('x', p11[featureIdx]!, p12[featureIdx]!, hview),
      axisSpan('y', p21[featureIdx]!, p22[featureIdx]!, vview),
    ],
    inverted: strands[featureIdx] === -1,
    attributes: featureAttributes(attributes, featureIdx),
    cigarOp,
    // A PAF names no feature, so the dictionary holds one empty string and the
    // Name line never appears.
    name: nameDict[nameIds[featureIdx]!],
  })
}
