import { JBrowse } from '@jbrowse/react-app2'

// The flattest assembly form: a name and a sequence-file URL. JBrowse picks the
// adapter (TwoBit/BgzipFasta/IndexedFasta) from the file extension.
const assemblies = [
  {
    name: 'volvox',
    uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
  },
]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
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
