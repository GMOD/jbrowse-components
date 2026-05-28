import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

const ViewWithErrorHandling = observer(function ViewWithErrorHandling({
  state,
}: {
  state: ViewModel
}) {
  const error = state.session.view.error
  if (error) {
    return <ErrorBanner error={error} />
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
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
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
