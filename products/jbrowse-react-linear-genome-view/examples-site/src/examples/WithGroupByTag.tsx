import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithGroupByTag() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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
      view={{
        loc: 'ctgA:39,728..40,459',
        tracks: [
          {
            trackId: 'volvox_bam',
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 400,
              color: { field: 'tags.HP' },
              facet: 'tags.HP',
            },
          },
        ],
      }}
    />
  )
}
