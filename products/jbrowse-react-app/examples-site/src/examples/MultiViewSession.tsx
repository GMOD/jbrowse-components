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
  {
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    uri: `${base}/volvox-sorted.cram`,
    category: ['Alignments'],
  },
]

export default function MultiViewSession() {
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
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..50000',
          tracks: ['volvox_cram'],
        },
      ]}
    />
  )
}
