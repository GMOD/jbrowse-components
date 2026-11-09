import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_translocation',
    name: 'ctgA/ctgB translocation reads',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-translocation.bam',
  },
]

export default function BreakpointSplit() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'BreakpointSplitView',
          views: [
            {
              loc: 'ctgA:19,500..20,500',
              assembly: 'volvox',
              tracks: ['volvox_translocation'],
            },
            {
              loc: 'ctgB:2,500..3,500',
              assembly: 'volvox',
              tracks: ['volvox_translocation'],
            },
          ],
        },
      ]}
    />
  )
}
