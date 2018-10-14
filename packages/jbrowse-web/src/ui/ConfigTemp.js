const MenuConfig = [
  {
    menuTitle: 'Genome',
    menuItems: [
      'Open sequence file',
      'Volvox Example',
      'MODEncode Example',
      'Yeast Example',
    ],
    itemCallbacks: [
      () => console.log('clicked menu item "Open sequence file"'),
      () => console.log('clicked menu item "Volvox Example"'),
      () => console.log('clicked menu item "MODEncode Example"'),
      () => console.log('clicked menu item "Yeast Example"'),
    ],
    itemIcons: ['folder_open', 'bookmark', 'bookmark', 'bookmark'],
  },
  {
    menuTitle: 'Track',
    menuItems: [
      'Open track file or URL',
      'Add combination track',
      'Add sequence search track',
    ],
    itemCallbacks: [
      () => console.log('clicked menu item "Open track file or URL"'),
      () => console.log('clicked menu item "Add combination track"'),
      () => console.log('clicked menu item "Add sequence search track"'),
    ],
    itemIcons: ['folder_open', 'playlist_add', 'find_in_page'],
  },
  {
    menuTitle: 'View',
    menuItems: [
      'Set highlight',
      'Clear highlight',
      'Resize quant. tracks',
      'Search features',
    ],
    itemCallbacks: [
      () => console.log('clicked menu item "Set highlight"'),
      () => console.log('clicked menu item "Clear highlight"'),
      () => console.log('clicked menu item "Resize quant. tracks"'),
      () => console.log('clicked menu item "Search features"'),
    ],
    itemIcons: ['highlight', 'highlight', 'photo_size_select_small', 'search'],
  },
  {
    menuTitle: 'Help',
    menuItems: ['About', 'General'],
    itemCallbacks: [
      () => console.log('clicked menu item "About"'),
      () => console.log('clicked menu item "General"'),
    ],
    itemIcons: ['info', 'help'],
  },
]

const TrackConfig = [
  {
    groupName: 'BAM',
    groupTracks: [
      {
        trackName: 'BAM - paired-read test pattern at 28kb',
        trackDetails:
          'small test pattern of BAM-format paired alignments of simulated resequencing reads on the volvox test ctgA+ctgB reference.',
        checked: false,
      },
      {
        trackName: 'BAM - volvox-longreads.bam',
        trackDetails: 'BAM-format alignments of simulated long reads.',
        checked: false,
      },
      {
        trackName: 'BAM - volvox-sorted SNPs/Coverage',
        trackDetails:
          'SNP/Coverage view of volvox-sorted.bam, simulated resequencing alignments.',
        checked: false,
      },
      {
        trackName: 'BAM - volvox-sorted.bam',
        trackDetails:
          'BAM-format alignments of simulated resequencing reads on the volvox test ctgA reference.',
        checked: false,
      },
      {
        trackName: 'CRAM - volvox-longreads.cram',
        trackDetails: 'CRAM-format alignments of simulated long reads.',
        checked: false,
      },
      {
        trackName: 'CRAM - volvox-sorted.cram',
        trackDetails:
          'CRAM-format alignments of simulated resequencing reads on the volvox test ctgA reference.',
        checked: false,
      },
    ],
  },
  {
    groupName: 'Miscellaneous',
    groupTracks: [
      {
        trackName: 'BEDTabix - volvox.bed in-memory adaptor',
        trackDetails:
          'This is just all the features in the volvox.bed test file, displayed using BED and tabix',
        checked: false,
      },
      {
        trackName: 'BigBed - volvox genes',
        trackDetails:
          'This is just all the features in the volvox.bb test file',
        checked: false,
      },
      {
        trackName: 'ChromHMM',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'FromConfig - Features in Configuration',
        trackDetails:
          'Demonstration of putting feature data directly in JBrowse configuration.',
        checked: false,
      },
      {
        trackName: 'GFF3 - sub-subparts',
        trackDetails:
          'This contains a gene model whose CDS features themselves have stop_codon_read_through',
        checked: false,
      },
      {
        trackName: 'GFF3 - volvox.gff3 in-memory adaptor',
        trackDetails:
          'This is just all the features in the volvox.gff3 test file, displayed directly from a web-accessible GFF3 file',
        checked: false,
      },
      {
        trackName: 'GFF3Tabix - volvox.gff3 in-memory adaptor',
        trackDetails:
          'This is just all the features in the volvox.gff3 test file, displayed using GFF3 and tabix',
        checked: false,
      },
      {
        trackName: 'GTF - volvox.gtf in-memory adaptor',
        trackDetails:
          'This is just all the features in the volvox.gtf test file, which like the volvox.gff3 file, is displayed directly from a web-accessible GTF file',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - ESTs',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - Example Features',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - Example motifs',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - Features with right-click menus',
        trackDetails: 'Features with customized right-click menus',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - Fingerprinted BACs',
        trackDetails: '',
        checked: false,
      },
      {
        trackName:
          'HTMLFeatures - Name test track has a really long track label',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - SNPs',
        trackDetails: '',
        checked: false,
      },
    ],
  },
  {
    groupName: 'Quantitative',
    groupTracks: [
      {
        groupName: 'Density',
        groupTracks: [
          {
            trackName: 'BigWig Density - volvox_microarray',
            trackDetails:
              'Wiggle/Density view of volvox_microarray.bw.  Also demonstrates use of a user-configurable callback to set the value of neg_color to green when the score is below 150.',
            checked: false,
          },
          {
            trackName: 'BigWig Density - volvox_sine',
            trackDetails: '',
            checked: false,
          },
        ],
      },
      {
        groupName: 'XY Plot',
        groupTracks: [
          {
            trackName: 'BigWig XY - volvox_microarray',
            trackDetails:
              'Wiggle/XYPlot view of volvox_microarray.bw.  Demonstrates use of a user-configured callback to set the bar color to red when the score is above 300.',
            checked: false,
          },
          {
            trackName: 'BigWig XY - volvox_sine',
            trackDetails: '',
            checked: false,
          },
        ],
      },
    ],
  },
  {
    groupName: 'Reference sequence',
    groupTracks: [
      {
        trackName: 'Reference sequence',
        trackDetails: '',
        checked: false,
      },
    ],
  },
  {
    groupName: 'Transcripts',
    groupTracks: [
      {
        trackName: 'CanvasFeatures - Protein-coding genes',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'CanvasFeatures - mixed mRNAs and CDSs',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'CanvasFeatures - transcripts',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'GFF3Tabix - volvox.gff3 with topLevelFeatures\\=mRNA',
        trackDetails:
          'This is the genes in the volvox-gff3 tabix file, displayed with HTMLFeatures',
        checked: false,
      },
      {
        trackName: 'HTMLFeatures - mRNAs',
        trackDetails: '',
        checked: false,
      },
    ],
  },
  {
    groupName: 'VCF',
    groupTracks: [
      {
        trackName: 'VCF - GVCF test data',
        trackDetails:
          'small test pattern of BAM-format paired alignments of simulated resequencing reads on the volvox test ctgA+ctgB reference.',
        checked: false,
      },
      {
        trackName: 'VCF - additional test data',
        trackDetails: '',
        checked: false,
      },
      {
        trackName: 'VCF - volvox-sorted variants',
        trackDetails:
          'Variants called from volvox-sorted.bam using samtools and bcftools.  Heterozygous variants are shown in red, homozygous variants in blue.',
        checked: false,
      },
    ],
  },
]

export { MenuConfig, TrackConfig }
