import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithInitAdvanced() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
        geneticCodes: { chrM: 2 },
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
      view={{
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
