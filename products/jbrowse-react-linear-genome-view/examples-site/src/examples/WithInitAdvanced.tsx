import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// managed API: the `init` blob is the component's whole declarative input —
// loc, which tracks to open (with per-display snapshots), tracklist/nav
// visibility, and highlights
export default function WithInitAdvanced() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        sequence: {
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
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'ncbi-refseq-genes',
          name: 'NCBI RefSeq Genes',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
          },
        },
      ]}
      init={{
        loc: 'chr1:11,106,077-11,261,675',
        tracklist: true,
        nav: true,
        tracks: [
          { trackId: 'ncbi-refseq-genes', displaySnapshot: { height: 200 } },
        ],
        highlight: ['chr1:11,170,000-11,190,000'],
      }}
    />
  )
}
