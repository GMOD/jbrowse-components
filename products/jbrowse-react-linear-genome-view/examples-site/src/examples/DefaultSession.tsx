import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function DefaultSession() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      sequence: {
        adapter: {
          type: 'TwoBitAdapter',
          uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
        },
      },
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
      {
        type: 'AlignmentsTrack',
        trackId: 'volvox-long-reads-sv-bam',
        name: 'volvox-long reads with SV',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BamAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam',
        },
      },
    ],
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
