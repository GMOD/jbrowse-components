import {
  DEMO_CONFIG,
  PARK_CURSOR,
  UCSC_HG38_CONFIG,
  VOLVOX,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// The delays cover the details pane's layout and the sequence fetch between the
// click and the select mounting.
const openFeatureSequence = (): ScreenshotAction[] => [
  { type: 'waitForText', text: 'Show feature sequence' },
  { type: 'delay', ms: 1000 },
  { type: 'click', text: 'Show feature sequence' },
  { type: 'delay', ms: 2000 },
  { type: 'click', selector: '[aria-label="Sequence type"]' },
  { type: 'delay', ms: 1000 },
]

// A PTEN-only slice of the NA12878 direct-RNA BAM: the whole-genome BAM never
// quiesces before the loading-overlay timeout.
export const PTEN_RNASEQ_BAM =
  'https://jbrowse.org/demos/rnaseq/NA12878-DirectRNA.PTEN.bam'
export const PTEN_RNASEQ_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: PTEN_RNASEQ_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${PTEN_RNASEQ_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}

// Loads protein3d from the plugin store's `latest/`, so a plugin release can
// change these figures with no commit here.
export const PROTEIN3D_CONFIG = 'test_data/protein3d_config.json'

// `dy` is the row the Apple3 mRNA packs into, from the track's top edge.
const APPLE3_MRNA = {
  trackId: 'gff3tabix_genes',
  loc: 'ctgA:17,400-23,000',
  fracY: 0,
  dy: 121,
}

const PROTEIN_LAUNCH_GENE_TRACK = 'hg38-ncbiRefSeqCurated'

const NES_MOTIF =
  '[data-testid="protein-feature-Motif"][data-feature-start="339"]'

// `longestCoding` draws one gene row near the top, so a centered right-click
// misses TP53 and opens the view's menu.
const PROTEIN_LAUNCH_ANCHOR = {
  trackId: PROTEIN_LAUNCH_GENE_TRACK,
  loc: 'chr17:7,676,000',
  fracY: 0.2,
}

// Uses the hosted hg38 config: against PROTEIN3D_CONFIG the gene menu has no
// protein launchers. The `proteins/annotation_1d` tour films the same route.
const PROTEIN_LAUNCH_SESSION = sessionSpec(UCSC_HG38_CONFIG, {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:7,668,000-7,688,000',
      tracks: [
        // PROTEIN_LAUNCH_ANCHOR's fracY depends on both settings
        {
          trackId: PROTEIN_LAUNCH_GENE_TRACK,
          geneGlyphMode: 'longestCoding',
          height: 60,
        },
      ],
    },
  ],
})

const OPEN_PROTEIN_LAUNCH_MENU: ScreenshotAction[] = [
  { type: 'rightclick', anchor: PROTEIN_LAUNCH_ANCHOR },
  { type: 'waitForText', text: 'Launch protein view' },
  { type: 'click', text: 'Launch protein view' },
  // the dialog enables Launch once UniProt has answered
  {
    type: 'waitForSelector',
    selector: 'button:not([disabled])::-p-text(Launch)',
    timeout: 120000,
  },
  { type: 'click', selector: 'button[aria-label="More launch options"]' },
]

export const proteinLaunchFixtures = {
  session: PROTEIN_LAUNCH_SESSION,
  geneAnchor: PROTEIN_LAUNCH_ANCHOR,
}

// Shared with the `ui/gene_track_sections` tour; the window holds all four
// `gene_biotype` values in GENE_CHANNEL_SPEC_JSON.
const GROUPING_WINDOW = 'chr17:7,540,000-7,640,000'
const GROUPING_TRACK = {
  trackId: 'ncbi_refseq_109_hg38_latest',
  geneGlyphMode: 'longestCoding',
  // description rows push the reverse-strand section off the frame
  showLabels: 'name',
}

// Pasted by the `ui/gene_track_channel_spec` tour and printed in gene_track.md.
export const GENE_CHANNEL_SPEC_JSON = `{
  "facet": {
    "field": "gene_biotype",
    "sort": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
  },
  "encoding": {
    "color": {
      "field": "gene_biotype",
      "scale": {
        "domain": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
      }
    }
  }
}`

const groupingSession = (height: number) =>
  lgvSession(DEMO_CONFIG, {
    assembly: 'hg38',
    loc: GROUPING_WINDOW,
    trackLabels: 'offset',
    tracks: [{ ...GROUPING_TRACK, height }],
  })

export const geneGroupingVideoFixtures = {
  trackId: GROUPING_TRACK.trackId,
  session: groupingSession(520),
  channelSpecSession: groupingSession(640),
}

export const featuresSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'about_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
    }),
    readyText: 'ctgA',
    // Leaves a blank-below warning on purpose: near 580 the dialog covers the
    // toolbar it was opened from.
    viewportHeight: 680,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'About track' },
      { type: 'waitForText', text: 'AlignmentsTrack' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // The window sits inside BRCA1 exon 11, so it shows one frame color. Residue
  // numbers (`Q1182`) draw only below about 105 bp (residueNumbersFit), too
  // narrow to span an intron.
  {
    mode: 'url',
    name: 'gene_track_color_by_cds',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr17:41,244,000-41,244,090',
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    viewportHeight: 500,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Show...', 'CDS reading frame colors']),
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          ...cascadeBoxes(['Show...', 'CDS reading frame colors']),
        ],
      },
      {
        // the checkbox row keeps the menu open (staysOnClick)
        actions: [
          { type: 'click', text: 'CDS reading frame colors' },
          // Clicks the menu backdrop, since Escape leaves the hamburger's
          // tooltip in the frame. The point must stay inside the viewport, or
          // the menu stays up.
          { type: 'click', from: { x: 700, y: 420 } },
        ],
      },
    ],
  },

  // GPX1's `transl_except=(pos:complement(49395565..49395567),aa:Sec)` codon.
  {
    mode: 'url',
    name: 'gene_track_selenocysteine',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr3:49,395,505-49,395,625',
      colorByFrame: true,
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          geneGlyphMode: 'longestCoding',
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    viewportHeight: 500,
  },

  {
    mode: 'url',
    name: 'gene_track_mature_peptides',
    url: lgvSession('test_data/enterovirus_d/config.json', {
      assembly: 'GCF_000861205.1',
      loc: 'NC_001430.1:727-7,311',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_genes_enterovirus_d',
          // fits the gene row and all 12 stacked mature peptides
          height: 220,
          filter: ['geneLike'],
        },
      ],
    }),
    readyText: 'NCBI genes',
    readyTimeout: 30000,
    viewportHeight: 425,
  },

  {
    mode: 'url',
    name: 'gene_track_group_by_strand',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: GROUPING_WINDOW,
      trackLabels: 'offset',
      tracks: [
        {
          ...GROUPING_TRACK,
          facet: 'strand',
          encoding: { color: 'strand' },
          height: 310,
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    viewportHeight: 520,
    tooltip: 'hide',
    // the second chip appears once the layout has stacked both sections
    actions: [{ type: 'waitForText', text: 'Reverse strand' }],
  },
  {
    mode: 'url',
    name: 'gene_track_collapse_introns',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'pten_directrna',
          name: 'NA12878 direct-RNA (PTEN)',
          assemblyNames: ['hg38'],
          adapter: PTEN_RNASEQ_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // The view spans more than PTEN so the gene sits mid-frame; the BAM is
          // a PTEN-only slice, so the reads still load at this width.
          loc: 'chr10:87,790,000-88,045,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              geneGlyphMode: 'longestCoding',
            },
            {
              trackId: 'pten_directrna',
              pileup: { readHeight: 3 },
              sashimi: {
                placement: 'auto',
              },
              // PTEN's 8 real introns carry 446-717 reads each and the
              // loudest noise junction 99; the cutoff sits mid-gap.
              filter: [{ field: 'junction.reads', gte: 200 }],
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    viewportHeight: 590,
    tooltip: 'hide',
    actions: [
      // readyText matches the track name, which renders before the GFF loads
      { type: 'waitForText', text: 'PTEN' },
    ],
    stages: [
      {
        actions: [
          { type: 'rightclick', text: 'PTEN' },
          { type: 'waitForText', text: 'Collapse introns' },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Collapse introns' } }],
      },
      {
        // `button::-p-text` keeps the click off dialog prose repeating the label
        actions: [
          { type: 'click', text: 'Collapse introns' },
          { type: 'waitForText', text: 'Replace current view' },
          { type: 'click', selector: 'button::-p-text(Replace current view)' },
          { type: 'waitForText', text: 'Replace current view', hidden: true },
          { type: 'waitForAppSettled' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="loading-overlay"]',
            hidden: true,
          },
        ],
      },
    ],
  },
  // HBB is small enough that the panel shows its UTRs, CDS and introns at once.
  {
    mode: 'url',
    name: 'feature_detail_sequence',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr11:5,224,000-5,228,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          geneGlyphMode: 'longestCoding',
          height: 200,
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    viewportHeight: 900,
    actions: [
      { type: 'click', text: 'HBB' },
      ...openFeatureSequence(),
      {
        type: 'click',
        selector:
          '[data-testid="sequence_type_gene_updownstream_collapsed_intron"]',
      },
    ],
  },

  // SELENOP carries ten `transl_except` selenocysteines.
  {
    mode: 'url',
    name: 'feature_detail_protein',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:42,799,000-42,812,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          geneGlyphMode: 'longestCoding',
          height: 200,
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    viewportHeight: 900,
    actions: [
      { type: 'click', text: 'SELENOP' },
      ...openFeatureSequence(),
      { type: 'click', text: 'Protein' },
    ],
  },

  // volvox's gff3tabix_genes config carries the formatDetails callback.
  {
    mode: 'url',
    name: 'customized_feature_details',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [{ trackId: 'gff3tabix_genes', height: 300 }],
    }),
    readyText: 'ctgA',
    viewportHeight: 680,
    actions: [
      { type: 'click', anchor: APPLE3_MRNA },
      { type: 'waitForText', text: 'extrafield' },
      // clears the hover shading the click leaves on the gene
      PARK_CURSOR,
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: 'a[href^="https://google.com/?q="]' },
      },
      {
        type: 'text',
        text: 'The callback turns the name into a clickable link',
        leader: true,
        anchor: {
          selector: 'a[href^="https://google.com/?q="]',
          alignX: 'left',
        },
        dx: -140,
      },
    ],
  },

  {
    mode: 'url',
    name: 'upstream_downstream_details',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [{ trackId: 'gff3tabix_genes', height: 300 }],
    }),
    readyText: 'ctgA',
    viewportHeight: 900,
    actions: [
      { type: 'click', anchor: APPLE3_MRNA },
      ...openFeatureSequence(),
      {
        type: 'click',
        text: 'Genomic w/ full introns +/- 100bp up+down stream',
      },
    ],
  },

  {
    mode: 'url',
    name: 'cytobands',
    viewportHeight: 347,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:38,543,322-41,918,323',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
  },

  {
    mode: 'url',
    name: 'protein/connected',
    viewportWidth: 2000,
    viewportHeight: 632,
    url: sessionSpec(PROTEIN3D_CONFIG, {
      views: [
        {
          type: 'ProteinView',
          uniprotId: 'P04637',
          transcriptId: 'NM_000546.6',
          height: 340,
          sideBySide: true,
          zoomToBaseLevel: false,
          connectedView: {
            assembly: 'hg38',
            loc: 'chr17:7,668,000-7,688,000',
            tracks: [
              {
                trackId: 'hg38-ncbiRefSeq',
                geneGlyphMode: 'longestCoding',
                height: 70,
              },
            ],
          },
        },
      ],
    }),
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 90000,
    clicksChange:
      'select the nuclear export signal, banding its codons on the gene and its residues on the structure',
    // the motif sits off-screen in the alignment panel's scroller until `scroll`
    actions: [
      { type: 'waitForSelector', selector: NES_MOTIF },
      { type: 'scroll', selector: NES_MOTIF },
      { type: 'click', selector: NES_MOTIF },
    ],
    tooltip: 'hide',
    annotations: [
      {
        type: 'text',
        text: 'Clicked: the nuclear export signal',
        fontSize: 18,
        leader: true,
        anchor: { selector: NES_MOTIF },
        dx: -260,
        dy: -125,
      },
      {
        type: 'text',
        text: 'Its codons on the gene',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'hg38-ncbiRefSeq',
          loc: 'chr17:7,670,650',
          fracY: 0.3,
        },
        dx: 80,
        dy: 10,
      },
      {
        type: 'text',
        text: 'Magenta: its residues on the structure',
        fontSize: 18,
        anchor: {
          selector: '[data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
          dx: 200,
          dy: 30,
        },
      },
    ],
  },

  // No callouts: protein3d prefixes each trackId with the view's generated id,
  // so no anchor can name one of its tracks.
  {
    mode: 'url',
    name: 'protein/annotation_1d',
    url: PROTEIN_LAUNCH_SESSION,
    readyText: 'NCBI RefSeq',
    readyTimeout: 120000,
    clicksChange: 'launch the 1D protein annotation view',
    actions: [
      ...OPEN_PROTEIN_LAUNCH_MENU,
      { type: 'click', text: 'Launch 1D protein annotation view' },
      { type: 'waitForText', text: 'type: Natural variant', timeout: 120000 },
      // protein3d opens ClinVar last
      { type: 'waitForText', text: 'ClinVar', timeout: 120000 },
      { type: 'waitForAppSettled' },
    ],
    // the launch leaves the cursor over the new view's tracks
    tooltip: 'hide',
    viewportHeight: 1500,
  },
]
