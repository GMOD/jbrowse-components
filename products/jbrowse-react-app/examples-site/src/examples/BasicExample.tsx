import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'TwoBitAdapter',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      },
    },
    refNameAliases: {
      adapter: {
        type: 'FromConfigAdapter',
        adapterId: 'W6DyPGJ0UU',
        features: [
          { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
          { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
        ],
      },
    },
  },
]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.cram',
    },
  },
]

export default function BasicExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
            tracks: ['volvox_cram'],
            tracklist: true,
          },
        },
      ]}
    />
  )
}
