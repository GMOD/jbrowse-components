import type { Region } from '@jbrowse/core/util'

// Off-screen px kept on each side of the viewport so panning reveals ribbons
// without a refetch. The worker's whole-feature cull (executeSyntenyFeaturesAnd
// Positions), the geometry emit cull (buildSyntenyGeometry), and the main-thread
// fetch window (syntenyFetchRegions) must all agree on this, so it is the single
// source of truth imported by each.
export const PAN_BUFFER_PX = 2000

// Pan buffer in px, widened to half the viewport on wide views. Sizes both the
// worker's whole-feature cull and the main-thread fetch window, so a feature the
// worker would keep is never left unfetched (fetch window >= cull window).
export function syntenyPanBufferPx(widthPx: number) {
  return Math.max(widthPx * 0.5, PAN_BUFFER_PX)
}

// A visible content block as returned by LinearGenomeView.visibleRegions. Only
// the fields syntenyFetchRegions needs are declared; the getter returns more.
interface VisibleRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
  displayedRegionIndex: number
}

// Scope the indexed synteny fetch to the visible window instead of the whole
// concatenated genome. For each visible content block, expand by the pan buffer,
// snap the result outward to a buffer-sized grid (so panning within a grid cell
// reuses the same window and doesn't refetch), then clamp to the enclosing
// displayed region.
//
// The output is a superset of the worker's cull window, so the worker's post-
// cull geometry is byte-identical to a whole-genome fetch — it just never
// downloads or projects the off-screen features it would have discarded anyway
// (the projection loop drops them before they enter the output arrays).
//
// When the buffered window already covers the whole displayed region (zoomed
// out, or a small region), it collapses to that region and stops moving on pan,
// preserving the no-pan-refetch behavior of normal small-region synteny.
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
