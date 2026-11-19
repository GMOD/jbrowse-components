import { minmax } from '@jbrowse/core/util'

/**
 * As much of a row or axis view as reading a coordinate back off it takes,
 * which a dotplot axis and a linear genome view both are.
 */
export interface SpanAxis {
  bpPerPx: number
  offsetPx: number
  pxToBp: (px: number) => {
    assemblyName: string
    refName: string
    start: number
    end: number
    offset: number
    reversed?: boolean
  }
}

/**
 * One axis' span of a feature or of one of its segments, from the two absolute
 * cumBp endpoints the geometry was built from.
 *
 * It goes through `pxToBp` rather than reading `refNameDict[refNameIds[i]]`,
 * which looks like the direct answer and is the wrong namespace: the dictionary
 * holds the names the ADAPTER used (the worker only ever sees regions put
 * through `renameRegionsIfNeeded`), while the axis holds the assembly's
 * canonical names. On an aliased track — a PAF naming `1` against an assembly
 * canonicalized `chr1` — the dictionary would print the file's spelling at the
 * user. Same rule as everywhere else: read the name off the region.
 *
 * `pxToBp` is also what applies the reversed-region reflection, which both
 * dotplot axes routinely carry — auto-diagonalize flips query regions on the
 * vertical axis.
 *
 * Both endpoints lie in one displayed region (`clampBlockToRegions` trimmed the
 * block to one region entry), so the region comes off the span's MIDPOINT and
 * both coordinates are measured inside it. Resolved per endpoint, one sitting
 * exactly on a region's end fell into the next region at offset 0, and
 * chr1:900-1000 printed as chr1:1-900.
 *
 * The coordinate is ROUNDED off `offset` rather than taken from `coord0`, which
 * floors. A feature endpoint is an exact integer bp, and the trip out to px and
 * back (`cumBp/bpPerPx` then `(offsetPx + px)*bpPerPx` inside pxToBp) lands a
 * hair either side of it — a relative error of ~1e-16, but the floor turns half
 * of those into an off-by-one, and which half depends on the current zoom. So
 * the same alignment read `y len: 593` at whole-genome zoom and `592` zoomed in;
 * `browser-tests/dotplot-hover-probe.ts` is what showed the two side by side.
 * Rounding recovers the integer because the error is nowhere near 0.5.
 * `coord0`'s floor is right for what it is for — naming the base under a pixel,
 * including pixels off the end of the region — and wrong for reading back a
 * coordinate that was exact on the way in.
 *
 * The side's fields are named explicitly rather than spread from the `pxToBp`
 * result, which carries the region's `reversed`, a fact about the axis rather
 * than the alignment.
 */
export function axisSpan(cumBpA: number, cumBpB: number, view: SpanAxis) {
  const { bpPerPx, offsetPx } = view
  const midCumBp = (cumBpA + cumBpB) / 2
  const r = view.pxToBp(midCumBp / bpPerPx - offsetPx)
  const regionCumBp = midCumBp - r.offset
  const coord = (cumBp: number) => {
    const offset = cumBp - regionCumBp
    return Math.round(r.reversed ? r.end - offset : r.start + offset)
  }
  const [start, end] = minmax(coord(cumBpA), coord(cumBpB))
  return { assemblyName: r.assemblyName, refName: r.refName, start, end }
}
