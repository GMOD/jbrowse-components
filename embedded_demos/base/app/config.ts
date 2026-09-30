const config = {
  assemblies: [
    {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
    },
  ],
  // Whole-track shorthand: the type and adapter come from each file's extension
  tracks: [
    {
      trackId: 'genes',
      name: 'NCBI RefSeq Genes',
      assemblyNames: ['hg38'],
      category: ['Genes'],
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
      textSearching: {
        textSearchAdapter:
          'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
      },
    },
    {
      trackId: 'repeats_hg38',
      name: 'Repeats',
      assemblyNames: ['hg38'],
      category: ['Annotation'],
      uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
    },
    {
      trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
      name: 'NA12878 Exome',
      assemblyNames: ['hg38'],
      category: ['1000 Genomes', 'Alignments'],
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    },
    {
      trackId:
        'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
      name: '1000 Genomes Variant Calls',
      assemblyNames: ['hg38'],
      category: ['1000 Genomes', 'Variants'],
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
    },
    {
      trackId: 'hg38.100way.phyloP100way',
      name: 'hg38.100way.phyloP100way',
      category: ['Conservation'],
      assemblyNames: ['hg38'],
      uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
    },
    {
      trackId: 'skbr3_pacbio',
      name: 'SKBR3 pacbio',
      assemblyNames: ['hg38'],
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/skbr3/SKBR3_Feb17_GRCh38.sorted.bam',
    },
  ],
  defaultSession: {
    name: 'this session',
    margin: 0,
    views: [
      {
        id: 'linearGenomeView',
        minimized: false,
        type: 'LinearGenomeView',
        loc: '10:29,838,565..29,838,850',
        assembly: 'hg38',
        tracks: [
          'hg38-ReferenceSequenceTrack',
          'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
          'hg38.100way.phyloP100way',
          'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
        ],
      },
    ],
  },
}

export default config
