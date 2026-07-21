import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv',
    name: 'volvox structural variants',
    assemblyNames: ['volvox'],
    category: ['Variants'],
    adapter: { type: 'VcfTabixAdapter', uri: `${base}/volvox.dup.vcf.gz` },
  },
]

export default function CircularExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'CircularView',
          init: {
            assembly: 'volvox',
            tracks: ['volvox_sv'],
          },
        },
      ]}
    />
  )
}
