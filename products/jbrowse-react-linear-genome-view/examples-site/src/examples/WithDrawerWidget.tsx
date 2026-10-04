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
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    height: '100vh',
    menuBar: true,
    view: {
      loc: 'ctgA:1105..1221',
      tracks: ['volvox_gff3'],
      tracklist: true,
    },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
