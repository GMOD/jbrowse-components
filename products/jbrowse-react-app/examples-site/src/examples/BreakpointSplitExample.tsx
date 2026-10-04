import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_sv_cram',
    name: 'volvox-sv (cram)',
    uri: `${base}/volvox-sv.cram`,
    category: ['Alignments'],
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
          views: [
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
