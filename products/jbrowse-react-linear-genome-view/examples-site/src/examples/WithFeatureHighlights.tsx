import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithFeatureHighlights() {
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
        loc: 'chr12:25,150,000-25,400,000',
        tracks: [
          {
            trackId: 'ncbi-refseq-genes',
            displaySnapshot: {
              height: 220,
              featureHighlights: [{ refName: 'chr12', name: 'KRAS' }],
            },
          },
        ],
      }}
    />
  )
}
