import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithMultipleDisplayedRegionsFlipped() {
  const state = useCreateViewState({
    assembly: {
      name: 'GRCh38',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
      aliases: ['hg38'],
      refNameAliases: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    tracks: [
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
    ],
    defaultSession: {
      name: 'Multi-region flipped example',
      view: {
        type: 'LinearGenomeView',
        // two displayed regions, the second reverse-complemented via its own
        // [rev] suffix — orientation is per-region, so they can differ
        loc: 'chr1:113073119..113073695 chr1:113091267..113091433[rev]',
        assembly: 'GRCh38',
        tracks: ['ncbi-refseq-genes'],
      },
    },
  })
  return state ? (
    <div>
      {/* horizontallyFlip() reverses the *arrangement*: the regions swap
          places and each one's own `reversed` flips with them. So there is no
          "is the view flipped" bit to read back — with these two regions,
          region 0 is forward-facing both before and after. The scalebar is
          what shows it */}
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
