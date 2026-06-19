import { useState } from 'react'
import { observer } from 'mobx-react'
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'
import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

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
]

const FlipView = observer(function FlipView({ state }: { state: ViewModel }) {
  const view = state.session.view
  const isFlipped = view.displayedRegions[0]?.reversed ?? false
  return (
    <div>
      <button
        onClick={() => {
          view.horizontallyFlip()
        }}
      >
        {isFlipped ? 'Unflip' : 'Flip horizontally'}
      </button>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
})

export default function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Multi-region flipped example',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'chr1:113073119..113073695 chr1:113091267..113091433',
            assembly: 'GRCh38',
            tracks: ['ncbi-refseq-genes'],
          },
        },
      },
    }),
  )
  return <FlipView state={state} />
}
