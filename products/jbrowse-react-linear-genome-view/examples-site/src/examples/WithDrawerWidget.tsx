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
    // a drawer needs the view beside it to be tall against something, and
    // `height` is that. Spelled out here because this is the page about the
    // drawer; with no height at all the view is bounded to '100vh' while a
    // drawer is open and content-height otherwise
    height: '100vh',
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
