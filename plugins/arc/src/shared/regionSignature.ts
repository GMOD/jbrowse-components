import { getContainingView } from '@jbrowse/core/util'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Arc has no `loadedRegions` spatial-coverage map (it fetches every feature into
// one array), so this string is its staleness axis. Block keys encode
// `assembly:refName:start:end`, so the signature changes exactly when arc would
// refetch — panning/zooming past a static-block boundary — and NOT on mere
// scroll within the loaded blocks. `setFeatures` records the signature of the
// blocks it fetched; `svgReady` compares it to the current one (via the shared
// `isDataCurrent` predicate in `@jbrowse/core/util`, the same freshness rule
// dotplot + synteny use) so an export fired mid-refetch waits for fresh arcs
// instead of capturing stale ones.
export function regionSignature(blocks: { key: string }[]) {
  return blocks.map(b => b.key).join(',')
}

// `self` is typed as the bare MST node (not `ArcDisplayModel`) on purpose:
// referencing the concrete model type here feeds back into the model's own
// `svgReady` return-type inference and makes the alias circular.
export function currentRegionSignature(self: IAnyStateTreeNode) {
  const view = getContainingView(self) as LinearGenomeViewModel
  return view.initialized
    ? regionSignature(view.staticBlocks.contentBlocks)
    : undefined
}
