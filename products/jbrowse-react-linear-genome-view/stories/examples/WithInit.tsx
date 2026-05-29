import { useState } from 'react'

import { ViewWithErrorHandling } from './util.tsx'
import { createViewState } from '../../src/index.ts'

export const WithInit = () => {
  const assembly = {
    name: 'hg38',
    aliases: ['GRCh38'],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'P6R5xbRqRr',
      adapter: {
        type: 'BgzipFastaAdapter',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      },
    },
    refNameAliases: {
      adapter: {
        type: 'RefNameAliasAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    cytobands: {
      adapter: {
        type: 'CytobandAdapter',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt',
      },
    },
  }

  const tracks = [
    {
      type: 'FeatureTrack',
      trackId: 'ncbi-refseq-genes',
      name: 'NCBI RefSeq Genes',
      category: ['Genes'],
      assemblyNames: ['hg38'],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: {
          uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
        },
        index: {
          location: {
            uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
          },
          indexType: 'CSI',
        },
      },
    },
  ]

  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Hello',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracks: ['ncbi-refseq-genes'],
          },
        },
      },
    }),
  )
  return (
    <div>
      <ViewWithErrorHandling state={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInit.tsx">
        Source code
      </a>
    </div>
  )
}
