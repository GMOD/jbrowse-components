import { createViewState } from '@jbrowse/react-linear-genome-view2'

// The engine half of a genome browser: assemblies, adapters, the RPC layer, the
// fetch/render lifecycle, and the MST state tree that ties them together. None
// of that is what makes a browser *look* like a browser, and none of it is what
// these examples rebuild — `createViewState` hands it all over in one call.
//
// What it does NOT give you is chrome. `state.session.view` is a
// LinearGenomeViewModel: it knows `bpPerPx`, `offsetPx`, `displayedRegions` and
// how to `zoomTo`/`horizontalScroll`, but it draws nothing. Rendering it is the
// part you own, and the part the sidebar walks through.
//
// No `makeWorkerInstance` here, so RPC runs on the main thread. That is one
// fewer moving piece for a demo; a real app passes a worker.

export const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

export const wiggleTrack = {
  type: 'QuantitativeTrack',
  trackId: 'volvox_microarray',
  name: 'Microarray signal',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
  },
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 100,
    color: '#3a7ca5',
    minScore: 0,
    maxScore: 1000,
  },
}

export const featureTrack = {
  type: 'FeatureTrack',
  trackId: 'volvox_genes',
  name: 'Genes',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  },
  displayDefaults: { height: 120 },
}

export const alignmentsTrack = {
  type: 'AlignmentsTrack',
  trackId: 'volvox_bam',
  name: 'Reads',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
  },
  displayDefaults: { height: 150 },
}

/**
 * Build the engine and point it at a locus. Returns the LinearGenomeView model
 * the examples render.
 *
 * `setInit` rather than poking `displayedRegions`/`tracks` directly: it is the
 * same declarative path a URL launch or a saved session takes, so the assembly
 * load, the navigation and the track show-ing all happen in the right order and
 * `view.initialized` flips only once there is something real to draw.
 */
export function makeView({
  tracks,
  loc,
  show,
}: {
  tracks: unknown[]
  loc: string
  show: string[]
}) {
  const state = createViewState({
    assembly: volvox,
    // createViewState's types describe the full config-schema shape; the plain
    // literals above are the documented shorthand for it
    tracks: tracks as never,
  })
  const { view } = state.session
  view.setInit({ assembly: volvox.name, loc, tracks: show })
  return view
}

export type BrowserView = ReturnType<typeof makeView>
