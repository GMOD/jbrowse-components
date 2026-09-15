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
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: { type: 'CramAdapter', uri: `${base}/volvox-sorted.cram` },
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
