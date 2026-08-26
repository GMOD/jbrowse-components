import { bucketBpPerPx, fetchWindowSignature } from '@jbrowse/synteny-core'

import type { Region } from '@jbrowse/core/util'
import type { LodTier } from '@jbrowse/synteny-core'

// One axis' contribution: its zoom, and a signature of its displayed regions'
// order and orientation. The signature arrives precomputed rather than being
// derived here from the axis' regions, because this key also depends on zoom —
// built in one place it rebuilt a string over every displayed region, for every
// display, on every wheel step. The view computes each axis' signature once
// (`hRegionSignature`/`vRegionSignature`), where it recomputes only when the
// regions actually change.
interface AxisFetchInputs {
  bpPerPx: number
  regionSignature: string
}

// Signature of the inputs a dotplot feature fetch depends on: the LOD tier, each
// axis's zoom and displayed-region order/orientation, and the snapped h-axis
// fetch window. When this changes — a zoom, a diagonalize reorder/flip of the
// query axis, or a pan past the buffered window — the currently held rpcData no
// longer corresponds to the axes and must be treated as stale (see the display's
// `dataCurrent`). This is the dotplot analog of LGV's
// `viewportWithinLoadedData`: it flips the instant the inputs change, before the
// debounced refetch has even started, so the `settled` gate can't report done
// on a plot that is still drawing yesterday's data against today's axes.
//
// `fetchRegions` is the grid-snapped output of `syntenyFetchRegions`, never the
// raw viewport — the snap is what keeps this key stable across sub-buffer pans.
// Keyed on the raw viewport it would flip on every pointer move of a drag,
// closing `svgReady` and the `settled` gate for the whole gesture.
//
// Each axis' zoom enters as a `bucketBpPerPx` bucket, not the raw value, the
// same way `LinearSyntenyDisplay.bpPerPxBucketKey` does: the exact zoom is
// carried into the fetch either way (the RPC args read it untracked), and what
// the key has to say is only whether the fetch would come back different. Raw,
// the whole-genome plot — where the fetch is every alignment in the file and
// `syntenyFetchRegions` has clamped its window to the displayed region, so the
// window term is constant — refetched on every wheel notch. See `bucketBpPerPx`
// for the measurement and for why the 2x a bucket admits is safe against
// `ZOOM_HEADROOM`.
export function dotplotFetchKey(
  // the resolved tier, never the 'auto' preference — see resolveLodTier
  lodTier: LodTier,
  hAxis: AxisFetchInputs,
  vAxis: AxisFetchInputs,
  fetchRegions: Region[],
) {
  const axis = (a: AxisFetchInputs) =>
    `${bucketBpPerPx(a.bpPerPx)}#${a.regionSignature}`
  return `${lodTier}::${axis(hAxis)}::${axis(vAxis)}::${fetchWindowSignature(fetchRegions)}`
}
