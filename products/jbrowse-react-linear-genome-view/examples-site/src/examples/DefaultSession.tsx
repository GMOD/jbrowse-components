import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function DefaultSession() {
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
      {
        trackId: 'volvox-long-reads-sv-bam',
        name: 'volvox-long reads with SV',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam',
      },
    ],
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        loc: 'ctgA:1105..1221',
        assembly: 'volvox',
        tracks: ['volvox-long-reads-sv-bam'],
      },
    },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
