import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'TwoBitAdapter',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      },
    },
    refNameAliases: {
      adapter: {
        type: 'FromConfigAdapter',
        adapterId: 'W6DyPGJ0UU',
        features: [
          { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
          { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
        ],
      },
    },
  },
]

const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv',
    name: 'volvox structural variants',
    assemblyNames: ['volvox'],
    category: ['Variants'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.cram',
    },
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
