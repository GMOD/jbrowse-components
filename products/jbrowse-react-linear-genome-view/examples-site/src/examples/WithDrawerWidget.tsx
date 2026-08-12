import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithDrawerWidget() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    // the height the view is clamped to *while a drawer is open*, so the
    // drawer has a definite scroll region. '100vh' is the default and is
    // spelled out here only because this is the page about the drawer — any
    // CSS height works ('600px', '80%')
    drawerViewHeight: '100vh',
    init: {
      loc: 'ctgA:1105..1221',
      tracks: ['volvox_gff3'],
      // open the hierarchical track selector in the drawer on first paint.
      // Declaring it rather than calling activateTrackSelector() on the built
      // engine is what gets the ordering right: init opens the drawer and waits
      // for the view to be resized around it *before* navigating, so the region
      // is framed at the width it will actually be drawn at. Clicking a feature
      // opens its details widget in the same drawer.
      tracklist: true,
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
