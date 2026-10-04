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
    ],
    defaultSession: {
      name: 'A session with a track of its own',
      sessionTracks: [
        {
          trackId: 'my-long-reads',
          name: 'Long reads I opened',
          assemblyNames: ['volvox'],
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam',
        },
      ],
      view: {
        type: 'LinearGenomeView',
        loc: 'ctgA:1105..1221',
        assembly: 'volvox',
        tracks: ['volvox_gff3', 'my-long-reads'],
      },
    },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
