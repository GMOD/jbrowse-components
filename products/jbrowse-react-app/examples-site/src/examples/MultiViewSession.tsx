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

// The react-app manages many views at once — the thing the single-view
// react-linear-genome-view component can't do. Pass more than one entry in
// `views` and the app stacks them, each with its own toolbar and track
// selector: here a whole-genome circular SV overview above a linear detail view.
export default function MultiViewSession() {
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
