import { assembly, tracks } from './managedExampleConfig.ts'
import { LinearGenomeView } from '../src/index.ts'

export default {
  title: 'LinearGenomeView (managed)/Basic',
  component: LinearGenomeView,
}

// the same scene as JBrowseLinearGenomeView's WithInit, but with no
// createViewState / useState ceremony: describe what to show via the `init`
// blob and the component owns the engine
function ManagedRender() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        assembly: 'hg38',
        loc: 'chr1:11,106,077-11,261,675',
        tracks: ['ncbi-refseq-genes'],
      }}
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
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz' },
      index: {
        location: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi' },
        indexType: 'CSI',
      },
    },
  },
]

// no useState, no createViewState — props are initial values, the component
// constructs and owns the engine. swap assembly/plugins by remounting via key
function App() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        assembly: 'hg38',
        loc: 'chr1:11,106,077-11,261,675',
        tracks: ['ncbi-refseq-genes'],
      }}
    />
  )
}`,
      },
    },
  },
}
