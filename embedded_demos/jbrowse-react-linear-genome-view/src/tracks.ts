const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['GRCh38'],
    category: ['Genes'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.tbi',
        },
      },
    },
    textSearching: {
      textSearchAdapter: {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'gff3tabix_genes-index',
        ixFilePath: {
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
        },
        ixxFilePath: {
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx',
        },
        metaFilePath: {
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz_meta.json',
        },
        assemblyNames: ['GRCh38'],
      },
    },
  },
  {
    type: 'FeatureTrack',
    trackId: 'repeats_hg38',
    name: 'Repeats',
    assemblyNames: ['hg38'],
    category: ['Annotation'],
    adapter: {
      type: 'BigBedAdapter',
      bigBedLocation: {
        uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
        locationType: 'UriLocation',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
    name: 'NA12878 Exome',
    assemblyNames: ['GRCh38'],
    category: ['1000 Genomes', 'Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      },
      craiLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
      },
      sequenceAdapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        },
        faiLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
        },
        gziLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
        },
      },
    },
  },
  {
    type: 'VariantTrack',
    trackId:
      'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
    name: '1000 Genomes Variant Calls',
    assemblyNames: ['GRCh38'],
    category: ['1000 Genomes', 'Variants'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz.tbi',
        },
      },
    },
  },
  {
    type: 'QuantitativeTrack',
    trackId: 'hg38.100way.phyloP100way',
    name: 'hg38.100way.phyloP100way',
    category: ['Conservation'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
        locationType: 'UriLocation',
      },
    },
  },
]

export default tracks
