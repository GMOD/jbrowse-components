import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function HumanExomeExample() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'GRCh38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
        aliases: ['hg38'],
        refNameAliases: {
          uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
        geneticCodes: { MT: 2 },
      }}
      tracks={[
        {
          trackId: 'ncbi-refseq-genes',
          name: 'NCBI RefSeq Genes',
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
        {
          trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
          name: 'NA12878 Exome',
          uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        },
      ]}
      view={{
        loc: '1:100,987,269..100,987,368',
        tracks: ['NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'],
      }}
    />
  )
}
