const config = {
  assemblies: [
    {
      name: 'GRCh38',
      aliases: ['hg38'],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'GRCh38-ReferenceSequenceTrack',
        adapter: {
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
      refNameAliases: {
        adapter: {
          type: 'RefNameAliasAdapter',
          location: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
          },
        },
      },
    },
  ],
  tracks: [
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
  ],
  defaultSession: {
    name: 'this session',
    margin: 0,
    views: [
      {
        id: 'linearGenomeView',
        minimized: false,
        type: 'LinearGenomeView',
        offsetPx: 191980240,
        bpPerPx: 0.1554251851851852,
        displayedRegions: [
          {
            refName: '10',
            start: 0,
            end: 133797422,
            reversed: false,
            assemblyName: 'GRCh38',
          },
        ],
        tracks: [
          {
            id: '4aZAiE-A3',
            type: 'ReferenceSequenceTrack',
            configuration: 'GRCh38-ReferenceSequenceTrack',
            minimized: false,
            displays: [
              {
                id: 'AD3gqvG0_6',
                type: 'LinearReferenceSequenceDisplay',
                height: 180,
                configuration:
                  'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
                showForward: true,
                showReverse: true,
                showTranslation: true,
              },
            ],
          },
          {
            id: 'T6uhrtY40O',
            type: 'AlignmentsTrack',
            configuration: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            minimized: false,
            displays: [
              {
                id: 'FinKswChSr',
                type: 'LinearAlignmentsDisplay',
                PileupDisplay: {
                  id: 'YAAaF494z',
                  type: 'LinearPileupDisplay',
                  height: 134,
                  configuration: {
                    type: 'LinearPileupDisplay',
                    displayId:
                      'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay_LinearPileupDisplay_xyz',
                  },
                  showSoftClipping: false,
                  filterBy: {
                    flagInclude: 0,
                    flagExclude: 1540,
                  },
                },
                SNPCoverageDisplay: {
                  id: 'VTQ_VGbAVJ',
                  type: 'LinearSNPCoverageDisplay',
                  height: 45,
                  configuration: {
                    type: 'LinearSNPCoverageDisplay',
                    displayId:
                      'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay_snpcoverage_xyz',
                  },
                  selectedRendering: '',
                  resolution: 1,
                  constraints: {},
                  filterBy: {
                    flagInclude: 0,
                    flagExclude: 1540,
                  },
                },
                snpCovHeight: 45,
                configuration:
                  'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome-LinearAlignmentsDisplay',
                height: 179,
                lowerPanelType: 'LinearPileupDisplay',
              },
            ],
          },
          {
            id: 'EUnTnpVI6',
            type: 'QuantitativeTrack',
            configuration: 'hg38.100way.phyloP100way',
            minimized: false,
            displays: [
              {
                id: 'mrlawr9Wtg',
                type: 'LinearWiggleDisplay',
                height: 100,
                configuration: 'hg38.100way.phyloP100way-LinearWiggleDisplay',
                selectedRendering: '',
                resolution: 1,
                constraints: {},
              },
            ],
          },
          {
            id: 'Cbnwl72EX',
            type: 'VariantTrack',
            configuration:
              'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf',
            minimized: false,
            displays: [
              {
                id: 'dvXz01Wf6w',
                type: 'LinearVariantDisplay',
                height: 100,
                configuration:
                  'ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf-LinearVariantDisplay',
              },
            ],
          },
        ],
        hideHeader: false,
        hideHeaderOverview: false,
        hideNoTracksActive: false,
        trackSelectorType: 'hierarchical',
        trackLabels: 'overlapping',
        showCenterLine: false,
        showCytobandsSetting: true,
        showGridlines: true,
      },
    ],
  },
}

export default config
