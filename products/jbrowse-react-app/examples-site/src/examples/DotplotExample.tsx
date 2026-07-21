import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

// a fake self-vs-self PAF, so both dotplot axes are the same assembly
const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'volvox_fake_synteny',
    name: 'volvox_fake_synteny',
    assemblyNames: ['volvox', 'volvox'],
    category: ['Synteny'],
    adapter: {
      type: 'PAFAdapter',
      uri: `${base}/volvox_fake_synteny.paf`,
      assemblyNames: ['volvox', 'volvox'],
    },
  },
]

export default function DotplotExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'DotplotView',
          init: {
            views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
            tracks: ['volvox_fake_synteny'],
          },
        },
      ]}
    />
  )
}
