import { JBrowse } from '../src/index.ts'

export default {
  title: 'JBrowse React App (managed)',
  component: JBrowse,
}

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: { type: 'TwoBitAdapter', uri: 'test_data/volvox/volvox.2bit' },
    },
  },
]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      uri: 'test_data/volvox/volvox-sorted.cram',
    },
  },
]

// session-centric: `views` lists what to open, each with its own view-type
// `init` blob. no createViewState / nested config object to hand-assemble
function ManagedRender() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
            tracks: ['volvox_cram'],
            tracklist: true,
          },
        },
      ]}
    />
  )
}

export const Managed = {
  render: ManagedRender,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `\
import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: { type: 'TwoBitAdapter', uri: 'test_data/volvox/volvox.2bit' },
    },
  },
]

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      uri: 'test_data/volvox/volvox-sorted.cram',
    },
  },
]

// session-centric: list the views to open, each with its own view-type init
function App() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
            tracks: ['volvox_cram'],
            tracklist: true,
          },
        },
      ]}
    />
  )
}`,
      },
    },
  },
}
