import type { Region } from '@jbrowse/core/util'

interface AxisSnap {
  bpPerPx: number
  displayedRegions: Region[]
}

// Signature of the inputs a dotplot feature fetch depends on: the LOD tier plus
// each axis's zoom and displayed-region order/orientation. When this changes —
// a zoom, or a diagonalize reorder/flip of the query axis — the currently held
// rpcData no longer corresponds to the axes and must be treated as stale (see
// the display's `dataCurrent`). This is the dotplot analog of LGV's
// `viewportWithinLoadedData`: it flips the instant the inputs change, before the
// debounced refetch has even started, so the `settled` gate can't report done
// on a plot that is still drawing yesterday's data against today's axes.
export function dotplotFetchKey(
  lodMode: string,
  hAxis: AxisSnap,
  vAxis: AxisSnap,
) {
  const axis = (a: AxisSnap) =>
    `${a.bpPerPx}#${a.displayedRegions
      .map(r => `${r.refName}:${r.start}:${r.end}:${r.reversed ? 1 : 0}`)
      .join('|')}`
  return `${lodMode}::${axis(hAxis)}::${axis(vAxis)}`
}
