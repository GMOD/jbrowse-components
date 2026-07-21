import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    adapter: { type: 'CramAdapter', uri: `${base}/volvox-sorted.cram` },
  },
]

export default function DarkTheme() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      configuration={{ theme: { palette: { mode: 'dark' } } }}
      views={[
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
            tracks: ['volvox_cram'],
          },
        },
      ]}
    />
  )
}
