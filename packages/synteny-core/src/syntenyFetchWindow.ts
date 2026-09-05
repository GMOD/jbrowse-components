import type { Region } from '@jbrowse/core/util'

// Floor for the off-screen px kept on each side of the viewport so panning
// reveals alignments without a refetch. Only a floor: every consumer goes
// through syntenyPanBufferPx below, which widens it on wide views. Also the cap
// on the band's overdraw, so a ribbon edge the frame can reach across is
// always inside the fetch window that holds it.
export const PAN_BUFFER_PX = 2000

// Pan buffer in px, widened to half the viewport on wide views. Sizes the one
// window a synteny level has: the fetch window is what the adapter is asked
// for, what the geometry stage emits detail for, and what the fetch key is
// built from, so a pan that keeps the key stays inside emitted geometry —
// `syntenyFetchWindow.test.ts` pins it. The dotplot maps every feature in the
// fetched regions, so there this sizes the fetch window alone.
export function syntenyPanBufferPx(widthPx: number) {
  return Math.max(widthPx * 0.5, PAN_BUFFER_PX)
}

// A visible content block as returned by LinearGenomeView.visibleRegions, or
// straight off `dynamicBlocks.contentBlocks` (dotplot's 1D axes). Only the
// fields syntenyFetchRegions needs are declared; both sources carry more.
interface VisibleRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
  displayedRegionIndex: number
}

// Scope an indexed comparative fetch (synteny query axis, dotplot h axis) to the
// visible window instead of the whole concatenated genome. For each visible
// content block, expand by the pan buffer, snap the result outward to a
// buffer-sized grid (so panning within a grid cell reuses the same window and
// doesn't refetch), then clamp to the enclosing displayed region.
//
// When the buffered window already covers the whole displayed region (zoomed
// out, or a small region), it collapses to that region and stops moving on pan,
// preserving the no-pan-refetch behavior of small-region synteny and of a
// whole-genome dotplot.
//
// Snapping is what makes this safe to key a fetch signature off: within a grid
// cell the output is byte-identical across pans, so a staleness key built from
// it doesn't flicker on every pointer move.
export function syntenyFetchRegions({
  visibleRegions,
  displayedRegions,
  width,
  bpPerPx,
}: {
  visibleRegions: VisibleRegion[]
  displayedRegions: Region[]
  width: number
  bpPerPx: number
}): Region[] {
  const bufferBp = syntenyPanBufferPx(width) * bpPerPx
  return visibleRegions.map(vr => {
    const dr = displayedRegions[vr.displayedRegionIndex]!
    const lo = Math.floor((vr.start - bufferBp) / bufferBp) * bufferBp
    const hi = Math.ceil((vr.end + bufferBp) / bufferBp) * bufferBp
    return {
      refName: vr.refName,
      assemblyName: vr.assemblyName,
      start: Math.max(dr.start, lo),
      end: Math.min(dr.end, hi),
    }
  })
}
