import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
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
      gffGzLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox-long-reads-sv-bam',
    name: 'volvox-long reads with SV',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam.bai',
        },
      },
    },
  },
]

export default function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:1105..1221',
          assembly: 'volvox',
          tracks: ['volvox-long-reads-sv-bam'],
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
