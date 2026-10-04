import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithMultipleDisplayedRegionsFlipped() {
  const state = useCreateViewState({
    assembly: {
      name: 'GRCh38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      aliases: ['hg38'],
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { MT: 2 },
    },
    tracks: [
      {
        trackId: 'ncbi-refseq-genes',
        name: 'NCBI RefSeq Genes',
        uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        category: ['Genes'],
      },
    ],
    defaultSession: {
      name: 'Multi-region flipped example',
      view: {
        type: 'LinearGenomeView',
        loc: 'chr1:113073119..113073695 chr1:113091267..113091433[rev]',
        assembly: 'GRCh38',
        tracks: ['ncbi-refseq-genes'],
      },
    },
  })
  return state ? (
    <div>
      <button
        onClick={() => {
          state.session.view.horizontallyFlip()
        }}
      >
        Flip horizontally
      </button>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  ) : null
}
