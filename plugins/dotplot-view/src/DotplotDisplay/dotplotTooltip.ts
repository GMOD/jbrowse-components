import { toLocale } from '@jbrowse/core/util'

import type { Dotplot1DViewModel } from '../DotplotView/1dview.ts'
import type { DotplotRpcData } from './types.ts'

// `{assembly}refName:start-end` for one axis' span of a feature, from the two
// absolute cumBp endpoints the geometry was built from.
//
// It goes through `pxToBp` rather than reading `refNameDict[refNameIds[i]]`,
// which looks like the direct answer and is the wrong namespace: the dictionary
// holds the names the ADAPTER used (the worker only ever sees regions put
// through `renameRegionsIfNeeded`), while the axis holds the assembly's
// canonical names. On an aliased track — a PAF naming `1` against an assembly
// canonicalized `chr1` — the dictionary would print the file's spelling at the
// user. Same rule as everywhere else: read the name off the region.
//
// `pxToBp` is also what applies the reversed-region reflection (its `coord0`;
// see `locstr`), which both dotplot axes routinely carry — auto-diagonalize
// flips query regions on the vertical axis.
//
// Both endpoints land in the same displayed region by construction
// (`clampBlockToRegions` trimmed the block to one region entry before
// projecting), so one end's refName names the whole span. An endpoint sitting
// exactly on a region boundary resolves into the neighbour, which still leaves
// the coordinate at the boundary — hence no out-of-bounds arm here.
function axisSpan(
  cumBpA: number,
  cumBpB: number,
  view: Dotplot1DViewModel,
): { label: string; length: number } {
  const { bpPerPx, offsetPx } = view
  const a = view.pxToBp(cumBpA / bpPerPx - offsetPx)
  const b = view.pxToBp(cumBpB / bpPerPx - offsetPx)
  const lo = Math.min(a.coord0, b.coord0)
  const hi = Math.max(a.coord0, b.coord0)
  return {
    label: `{${a.assemblyName}}${a.refName}:${toLocale(lo)}-${toLocale(hi)}`,
    length: hi - lo,
  }
}

// Integers (mapping quality, a declared count) read better unabbreviated;
// ratios (identity, dn/ds) need their significant digits and not 17 of them.
function formatAttribute(value: number) {
  return Number.isInteger(value)
    ? toLocale(value)
    : String(Number(value.toPrecision(3)))
}

/**
 * The hover tooltip for one dotplot feature, as lines.
 *
 * Lines rather than synteny's `<br/>`-joined HTML string: a refName comes out of
 * a file and can hold anything, and the caller renders these as text nodes, so
 * nothing here has to be trusted or sanitized on the way to the screen.
 *
 * The two spans are the DRAWN ones (the trimmed cumBp endpoints), not
 * `alignmentLengths` — that is the feature's full reference span, which on a
 * block trimmed to the displayed region disagrees with the locations printed
 * right above it. Every numeric channel the fetch carries a value for is
 * listed; -1 is the worker's missing sentinel (see `computeDotplotColors`).
 */
export function getDotplotTooltipLines({
  rpcData,
  featureIdx,
  hview,
  vview,
}: {
  rpcData: DotplotRpcData
  featureIdx: number
  hview: Dotplot1DViewModel
  vview: Dotplot1DViewModel
}) {
  const { p11, p12, p21, p22, strands, attributes } = rpcData
  const h = axisSpan(p11[featureIdx]!, p12[featureIdx]!, hview)
  const v = axisSpan(p21[featureIdx]!, p22[featureIdx]!, vview)
  const lines = [
    `x - ${h.label}`,
    `y - ${v.label}`,
    `Inverted: ${strands[featureIdx] === -1}`,
    `x len: ${toLocale(h.length)}`,
    `y len: ${toLocale(v.length)}`,
  ]
  for (const [name, values] of Object.entries(attributes)) {
    const value = values[featureIdx]
    if (value !== undefined && value >= 0) {
      lines.push(`${name}: ${formatAttribute(value)}`)
    }
  }
  return lines
}
