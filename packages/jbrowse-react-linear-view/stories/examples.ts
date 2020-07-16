export const exampleAssembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: {
        uri: 'test_data/volvox/volvox.2bit',
      },
    },
    rendering: {
      type: 'DivSequenceRenderer',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'alias1',
          aliases: ['A', 'contigA'],
        },
        {
          refName: 'ctgB',
          uniqueId: 'alias2',
          aliases: ['B', 'contigB'],
        },
      ],
    },
  },
}

export const exampleTracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_test_vcf',
    name: 'volvox 1000genomes vcf',
    assemblyNames: ['volvox'],
    category: ['VCF'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'test_data/volvox/volvox.test.vcf.gz',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox.test.vcf.gz.tbi',
        },
      },
    },
  },
  {
    type: 'VariantTrack',
    trackId: 'volvox_filtered_vcf',
    name: 'volvox filtered vcf',
    assemblyNames: ['volvox'],
    category: ['VCF'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'test_data/volvox/volvox.filtered.vcf.gz',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox.filtered.vcf.gz.tbi',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
        maxFeatureGlyphExpansion: 0,
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox-long-reads-sv-bam',
    name: 'volvox-long reads with SV',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'test_data/volvox/volvox-long-reads-sv.bam',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox-long-reads-sv.bam.bai',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox-long-reads-sv-cram',
    name: 'volvox-long reads with SV (cram)',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'test_data/volvox/volvox-long-reads-sv.cram',
      },
      craiLocation: {
        uri: 'test_data/volvox/volvox-long-reads-sv.cram.crai',
      },
      sequenceAdapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: {
          uri: 'test_data/volvox/volvox.2bit',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox-long-reads-cram',
    name: 'volvox-long reads (cram)',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'test_data/volvox/volvox-long-reads.fastq.sorted.cram',
      },
      craiLocation: {
        uri: 'test_data/volvox/volvox-long-reads.fastq.sorted.cram.crai',
      },
      sequenceAdapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: {
          uri: 'test_data/volvox/volvox.2bit',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox-long-reads-bam',
    name: 'volvox-long reads',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'test_data/volvox/volvox-long-reads.fastq.sorted.bam',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox-long-reads.fastq.sorted.bam.bai',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_samspec_cram',
    name: 'volvox-samspec (cram)',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'test_data/volvox/volvox-samspec.cram',
      },
      craiLocation: {
        uri: 'test_data/volvox/volvox-samspec.cram.crai',
      },
      sequenceAdapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: {
          uri: 'test_data/volvox/volvox.2bit',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_samspec',
    name: 'volvox-samspec',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'test_data/volvox/volvox-samspec.bam',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox-samspec.bam.bai',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_sv_cram',
    name: 'volvox-sv (cram)',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'test_data/volvox/volvox-sv.cram',
      },
      craiLocation: {
        uri: 'test_data/volvox/volvox-sv.cram.crai',
      },
      sequenceAdapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: {
          uri: 'test_data/volvox/volvox.2bit',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_sv',
    name: 'volvox-sv',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'test_data/volvox/volvox-sv.bam',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox-sv.bam.bai',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'BasicTrack',
    trackId: 'gff3tabix_genes',
    assemblyNames: ['volvox'],
    name: 'GFF3Tabix genes',
    category: ['Miscellaneous'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
    renderer: {
      type: 'SvgFeatureRenderer',
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'test_data/volvox/volvox-sorted.cram',
      },
      craiLocation: {
        uri: 'test_data/volvox/volvox-sorted.cram.crai',
      },
      sequenceAdapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: {
          uri: 'test_data/volvox/volvox.2bit',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_bam',
    name: 'volvox-sorted.bam',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'BamAdapter',
      bamLocation: {
        uri: 'test_data/volvox/volvox-sorted.bam',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox-sorted.bam.bai',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
      SNPCoverageRenderer: {
        type: 'SNPCoverageRenderer',
      },
    },
  },
  {
    type: 'VariantTrack',
    trackId: 'TBggZ1Rwy_p',
    name: 'volvox filtered vcf',
    assemblyNames: ['volvox'],
    category: ['Variants'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'test_data/volvox/volvox.filtered.vcf.gz',
      },
      index: {
        location: {
          uri: 'test_data/volvox/volvox.filtered.vcf.gz.tbi',
        },
      },
    },
    renderers: {
      PileupRenderer: {
        type: 'PileupRenderer',
      },
      SvgFeatureRenderer: {
        type: 'SvgFeatureRenderer',
      },
    },
  },
  {
    type: 'BasicTrack',
    trackId: 'bigbed_genes',
    name: 'BigBed genes',
    assemblyNames: ['volvox'],
    category: ['Miscellaneous'],
    adapter: {
      type: 'BigBedAdapter',
      bigBedLocation: {
        uri: 'test_data/volvox/volvox.bb',
      },
    },
    renderer: {
      type: 'SvgFeatureRenderer',
    },
  },
  {
    type: 'BasicTrack',
    trackId: 'bedtabix_genes',
    name: 'BedTabix genes',
    assemblyNames: ['volvox'],
    category: ['Miscellaneous'],
    adapter: {
      type: 'BedTabixAdapter',
      bedGzLocation: {
        uri: 'test_data/volvox/volvox-bed12.bed.gz',
      },
      index: {
        type: 'TBI',
        location: {
          uri: 'test_data/volvox/volvox-bed12.bed.gz.tbi',
        },
      },
    },
    renderer: {
      type: 'SvgFeatureRenderer',
    },
  },
  {
    type: 'WiggleTrack',
    trackId: 'LrM3WWJR0tj',
    name: 'Volvox microarray',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'Line'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray.bw',
      },
    },
    defaultRendering: 'line',
  },
  {
    type: 'WiggleTrack',
    trackId: 'VUyE25kYsQo',
    name: 'Volvox microarray',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'Density'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray.bw',
      },
    },
    defaultRendering: 'density',
  },
  {
    type: 'WiggleTrack',
    trackId: '24eGIUSM86l',
    name: 'Volvox microarray',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'XYPlot'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray.bw',
      },
    },
  },
  {
    type: 'WiggleTrack',
    trackId: 'oMVFQozR9NO',
    name: 'Volvox microarray - negative',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'Density'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray_negative.bw',
      },
    },
    defaultRendering: 'density',
  },
  {
    type: 'WiggleTrack',
    trackId: '1at1sLO1Gsl',
    name: 'Volvox microarray - negative',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'XYPlot'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray_negative.bw',
      },
    },
  },
  {
    type: 'WiggleTrack',
    trackId: 'wiggle_track_posneg',
    name: 'Volvox microarray with +/- values',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'Line'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray_posneg.bw',
      },
    },
    defaultRendering: 'line',
  },
  {
    type: 'WiggleTrack',
    trackId: 'wiggle_track_fractional_posneg',
    name: 'Volvox microarray with +/- fractional values',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'Line'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray_posneg_frac.bw',
      },
    },
    defaultRendering: 'line',
  },
  {
    type: 'WiggleTrack',
    trackId: 'jdYHuGnpAc_',
    name: 'Volvox microarray with +/- values',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'XYPlot'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox_microarray_posneg.bw',
      },
    },
  },
  {
    type: 'WiggleTrack',
    trackId: 'p7FU-K6WqS_',
    name: 'Volvox - BAM coverage',
    assemblyNames: ['volvox'],
    category: ['BigWig', 'Line'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox-sorted.bam.coverage.bw',
      },
    },
    defaultRendering: 'line',
  },
  {
    type: 'WiggleTrack',
    trackId: 'pOOtg9wxcUC',
    name: 'Volvox - BAM coverage',
    assemblyNames: ['volvox'],
    category: ['BigWig'],
    adapter: {
      type: 'BigWigAdapter',
      bigWigLocation: {
        uri: 'test_data/volvox/volvox-sorted.bam.coverage.bw',
      },
    },
  },
]

export const exampleSession = {
  name: 'this session',
  view: {
    id: 'linearGenomeView',
    type: 'LinearGenomeView',
    displayName: 'myView',
    bpPerPx: 0.5,
    displayedRegions: [
      {
        refName: 'ctgA',
        start: 0,
        end: 50001,
        reversed: false,
        assemblyName: 'volvox',
      },
    ],
    tracks: [
      {
        type: 'ReferenceSequenceTrack',
        height: 100,
        configuration: 'volvox_refseq',
      },
    ],
  },
}
