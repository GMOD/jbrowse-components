import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// managed API: props are initial values, the component owns the engine
export default function WithGroupByTag() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        sequence: {
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
          },
        },
      }}
      tracks={[
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_bam',
          name: 'volvox-sorted.bam',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'BamAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
          },
        },
      ]}
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
