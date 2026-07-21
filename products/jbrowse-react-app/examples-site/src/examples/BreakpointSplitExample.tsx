import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

// a CRAM of reads spanning a structural variant between ctgA and ctgB
const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_sv_cram',
    name: 'volvox-sv (cram)',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: { type: 'CramAdapter', uri: `${base}/volvox-sv.cram` },
  },
]

export default function BreakpointSplitExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'BreakpointSplitView',
          init: [
            {
              loc: 'ctgA:1-5000',
              assembly: 'volvox',
              tracks: ['volvox_sv_cram'],
            },
            {
              loc: 'ctgB:1-5000',
              assembly: 'volvox',
              tracks: ['volvox_sv_cram'],
            },
          ],
        },
      ]}
    />
  )
}
