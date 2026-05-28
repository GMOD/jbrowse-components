// in your code
// import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

const assembly = {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    category: ['Genes'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
    name: 'NA12878 Exome',
    category: ['1000 Genomes', 'Alignments'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      // CRAM decoding requires a copy of the assembly's sequence adapter;
      // BAM files without MD tags also require sequenceAdapter
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      },
    },
  },
]

export const HumanExomeExample = () => {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'My session',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: '1:100,987,269..100,987,368',
            assembly: 'GRCh38',
            tracks: ['NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'],
          },
        },
      },
    }),
  )

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/HumanExomeExample.tsx">
        Source code
      </a>
    </div>
  )
}
