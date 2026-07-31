import { regionSignature } from '@jbrowse/synteny-core'

import type { Region } from '@jbrowse/core/util'
import type { BpIndexViewSnap, LodTier } from '@jbrowse/synteny-core'

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
export function dotplotFetchKey(
  // the resolved tier, never the 'auto' preference — see resolveLodTier
  lodTier: LodTier,
  hAxis: BpIndexViewSnap,
  vAxis: BpIndexViewSnap,
  fetchRegions: Region[],
) {
  const axis = (a: BpIndexViewSnap) =>
    `${a.bpPerPx}#${regionSignature(a.displayedRegions)}`
  const window = fetchRegions
    .map(r => `${r.refName}:${r.start}-${r.end}`)
    .join(',')
  return `${lodTier}::${axis(hAxis)}::${axis(vAxis)}::${window}`
}
