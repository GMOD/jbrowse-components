import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_sv',
    name: 'volvox structural variants',
    uri: `${base}/volvox.dup.vcf.gz`,
    category: ['Variants'],
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
          assembly: 'volvox',
          tracks: ['volvox_sv'],
        },
      ]}
    />
  )
}
