import { JBrowse } from '@jbrowse/react-app2'

const assemblies = [
  {
    name: 'GRCh38',
    aliases: ['hg38'],
    uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    refNameAliases: {
      uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
    geneticCodes: { chrM: 2 },
  },
]

const tracks = [
  {
    trackId: 'genes',
    name: 'NCBI RefSeq Genes',
    uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    category: ['Genes'],
    textSearching: {
      textSearchAdapter:
        'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
    },
  },
  {
    trackId: 'repeats_hg38',
    name: 'Repeats',
    uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
    category: ['Annotation'],
  },
  {
    trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
    name: 'NA12878 Exome',
    uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    category: ['1000 Genomes', 'Alignments'],
  },
  {
    trackId:
      'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
    name: '1000 Genomes Variant Calls',
    uri: 'https://jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
    category: ['1000 Genomes', 'Variants'],
  },
  {
    trackId: 'hg38.100way.phyloP100way',
    name: 'hg38.100way.phyloP100way',
    uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
    category: ['Conservation'],
  },
]

export default function HumanDemo() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'LinearGenomeView',
          loc: 'chr7:155,799,529..155,812,871',
          assembly: 'hg38',
          tracks: [
            'genes',
            'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
            'hg38.100way.phyloP100way',
          ],
        },
      ]}
    />
  )
}
