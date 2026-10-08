import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

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

export default function Dotplot() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'DotplotView',
          views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
          tracks: ['volvox_fake_synteny'],
        },
      ]}
    />
  )
}
