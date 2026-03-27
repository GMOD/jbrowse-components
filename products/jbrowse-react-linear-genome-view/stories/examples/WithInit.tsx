import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

const ViewWithErrorHandling = observer(function ViewWithErrorHandling({
  state,
}: {
  state: ViewModel
}) {
  const error = state.session.view.error
  if (error) {
    return <ErrorMessage error={error} />
  }
  return <JBrowseLinearGenomeView viewState={state} />
})

export const WithInit = () => {
  const assembly = {
    name: 'hg38',
    aliases: ['GRCh38'],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'P6R5xbRqRr',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        },
        faiLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
        },
        gziLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
        },
      },
    },
    refNameAliases: {
      adapter: {
        type: 'RefNameAliasAdapter',
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      },
    },
    cytobands: {
      adapter: {
        type: 'CytobandAdapter',
        cytobandLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt',
        },
      },
    },
  }

  const tracks = [
    {
      type: 'FeatureTrack',
      trackId:
        'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
      name: 'NCBI RefSeq Genes',
      category: ['Genes'],
      assemblyNames: ['hg38'],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
        index: {
          location: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.tbi',
          },
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
          showCytobandsSetting: true,
          showGridlines: false,
          colorByCDS: true,
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracks: [
              'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
            ],
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
