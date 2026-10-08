import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function ViewSpelledOut() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
        geneticCodes: { chrM: 2 },
      }}
      tracks={[
        {
          trackId: 'ncbi-refseq-genes',
          name: 'NCBI RefSeq Genes',
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
      ]}
      height="400px"
      view={{
        loc: 'chr1:11,106,077-11,261,675',
        tracklist: true,
        nav: true,
        tracks: [
          { trackId: 'ncbi-refseq-genes', displaySnapshot: { height: 200 } },
        ],
        highlight: [
          'chr1:11,130,000-11,145,000',
          {
            refName: 'chr1',
            start: 11_200_000,
            end: 11_220_000,
            color: 'rgba(0, 128, 255, 0.25)',
            label: 'Region of interest',
          },
        ],
      }}
    />
  )
}
