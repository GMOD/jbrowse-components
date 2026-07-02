import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_bam',
    name: 'volvox-sorted.bam',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam.bai',
        },
      },
    },
  },
]

// managed API: props are initial values, the component owns the engine
export default function App() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        loc: 'ctgA:39,728..40,459',
        tracks: [
          {
            trackId: 'volvox_bam',
            // colorBy + groupBy are alignments config slots. pairing them on the
            // same tag colors each haplotype distinctly within its group.
            // increase height so all groups (HP:0, HP:1, unassigned) are visible
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 400,
              colorBy: { type: 'tag', tag: 'HP' },
              groupBy: { type: 'tag', tag: 'HP' },
            },
          },
        ],
      }}
    />
  )
}
