import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  },
}

const tracks = [
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
]

export default function WithDrawerWidget() {
  const state = useCreateViewState({
    assembly,
    tracks,
    drawerViewHeight: '100vh',
    defaultSession: {
      name: 'Drawer Widget Example',
      view: {
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1105..1221',
          tracklist: true,
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
