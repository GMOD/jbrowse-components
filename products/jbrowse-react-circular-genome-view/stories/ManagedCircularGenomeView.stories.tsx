import { CircularGenomeView } from '../src/index.ts'

export default {
  title: 'Circular Genome View (managed)',
  component: CircularGenomeView,
}

const assembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'test_data/volvox/volvox.2bit',
    },
  },
}

const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv_test',
    name: 'volvox structural variant test',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'test_data/volvox/volvox.dup.vcf.gz',
    },
  },
]

// no useState, no createViewState — describe what to show via the `init` blob
// and the component owns the engine
function ManagedRender() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{ assembly: 'volvox', tracks: ['volvox_sv_test'] }}
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
import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: { type: 'TwoBitAdapter', uri: 'test_data/volvox/volvox.2bit' },
  },
}

const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv_test',
    name: 'volvox structural variant test',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'test_data/volvox/volvox.dup.vcf.gz',
    },
  },
]

function App() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{ assembly: 'volvox', tracks: ['volvox_sv_test'] }}
    />
  )
}`,
      },
    },
  },
}
