import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the four Dog10K tutorials. test_data/dog10k/config.json reads
// data built by the scripts/build_dog10k_* scripts.

const DOG_CONFIG = 'test_data/dog10k/config.json'

interface SampleRow {
  name: string
  label: string
  color?: string
}

function arrangedSamples(rows: SampleRow[]) {
  const tinted = rows.filter(r => r.color)
  return {
    rows: {
      sort: rows.map(r => r.name),
      labels: Object.fromEntries(rows.map(r => [r.name, r.label])),
    },
    ...(tinted.length
      ? {
          rowColor: {
            scale: {
              domain: tinted.map(r => r.name),
              range: tinted.map(r => r.color!),
            },
          },
        }
      : {}),
  }
}

// One x for the four local-ancestry pills, so they left-align. The display's
// row labels overlay its data, so the x must clear ~220px; at 6 Mb every pill
// sat on the labels.
const WOLFDOG_PILL_X = 'chr1:20,000,000'

// IDs in the VCF's own order. The track facets them on the samples table's
// `clade`.
const CEA_GROUPS = [
  {
    label: 'Collie',
    ids: Array.from(
      { length: 13 },
      (_, i) => `COLL0000${String(i + 1).padStart(2, '0')}`,
    ),
  },
  {
    label: 'Shetland Sheepdog',
    ids: ['SSHP000001', 'SSHP000002', 'SSHP000003', 'SSHP000004'],
  },
  {
    label: 'Lancashire Heeler',
    ids: ['LANC000001', 'LANC000002', 'LANC000003', 'LANC000004'],
  },
  {
    label: 'Silken Windhound',
    ids: ['SKWH000001', 'SKWH000002'],
  },
  {
    label: 'Australian Shepherd',
    ids: ['AUSS000001', 'AUSS000002', 'AUSS000003'],
  },
  {
    label: 'German Shepherd',
    ids: ['GRSD000002', 'GRSD000003'],
  },
  {
    label: 'Labrador Retriever',
    ids: ['LABR000001', 'LABR000002', 'LABR000003', 'LABR000004'],
  },
  {
    label: 'Wolf',
    ids: ['CLUPGR000001', 'CLUPGR000002', 'CLUPGR000003', 'CLUPGR000004'],
  },
]

// Carrier breeds first, then two non-carriers, then the wolves as the control.
const CYP_GROUPS = [
  { label: 'German Hound', color: '#0072B2', n: 6, prefix: 'GHND' },
  { label: 'Bohemian Shepherd', color: '#0072B2', n: 6, prefix: 'BHSP' },
  { label: 'Shetland Sheepdog', color: '#0072B2', n: 4, prefix: 'SSHP' },
  { label: 'Black Russian Terrier', color: '#0072B2', n: 5, prefix: 'BRTR' },
  { label: 'Keeshond', color: '#0072B2', n: 5, prefix: 'KEES', from: 2 },
  { label: 'Labrador Retriever', color: '#999999', n: 5, prefix: 'LABR' },
  { label: 'Boxer', color: '#999999', n: 4, prefix: 'BOXR' },
  { label: 'Wolf', color: '#E69F00', n: 4, prefix: 'CLUPGR' },
]

const CYP_ROWS = arrangedSamples(
  CYP_GROUPS.flatMap(({ label, color, n, prefix, from = 1 }) =>
    Array.from({ length: n }, (_, i) => ({
      name: `${prefix}${String(from + i).padStart(6, '0')}`,
      label: `${label} ${i + 1}`,
      color,
    })),
  ),
)

// Ids are spelled out because two runs have holes: no CLUPCN000008, and the
// Tajikistan wolves are 3 and 5. The swatch is the track's own `rowColor:
// 'group'`.

const AMY2B_GROUPS: [string, string[]][] = [
  [
    'Labrador Retriever',
    [
      'LABR000001',
      'LABR000002',
      'LABR000003',
      'LABR000004',
      'LABR000005',
      'LABR000006',
    ],
  ],
  [
    'Boxer',
    ['BOXR000001', 'BOXR000002', 'BOXR000003', 'BOXR000004', 'BOXR000005'],
  ],
  ['Greenland Dog', ['GREE000001', 'GREE000002', 'GREE000003']],
  ['Alaskan Malamute', ['AMAL000001', 'AMAL000002', 'AMAL000003']],
  ['Samoyed', ['SAMO000001', 'SAMO000002', 'SAMO000003', 'SAMO000004']],
  ['English Springer Spaniel', ['ESSP000001', 'ESSP000002', 'ESSP000003']],
  [
    'Czechoslovakian Wolfdog',
    ['CZEC000001', 'CZEC000002', 'CZEC000003', 'CZEC000004'],
  ],
  ['Alaska village dog', ['VILLAK000001', 'VILLAK000002', 'VILLAK000003']],
  [
    'Greece wolf',
    [
      'CLUPGR000001',
      'CLUPGR000002',
      'CLUPGR000003',
      'CLUPGR000004',
      'CLUPGR000005',
      'CLUPGR000006',
      'CLUPGR000007',
      'CLUPGR000008',
      'CLUPGR000009',
      'CLUPGR000010',
      'CLUPGR000011',
      'CLUPGR000012',
    ],
  ],
  [
    'Sweden wolf',
    [
      'CLUPSE000001',
      'CLUPSE000002',
      'CLUPSE000003',
      'CLUPSE000004',
      'CLUPSE000005',
      'CLUPSE000006',
    ],
  ],
  ['Portugal wolf', ['CLUPPT000001', 'CLUPPT000002']],
  [
    'Russia wolf',
    [
      'CLUPRU000001',
      'CLUPRU000002',
      'CLUPRU000003',
      'CLUPRU000004',
      'CLUPRU000005',
      'CLUPRU000006',
      'CLUPRU000007',
      'CLUPRU000008',
      'CLUPRU000009',
      'CLUPRU000010',
      'CLUPRU000011',
      'CLUPRU000012',
      'CLUPRU000013',
      'CLUPRU000014',
    ],
  ],
  [
    'China wolf',
    [
      'CLUPCN000001',
      'CLUPCN000002',
      'CLUPCN000003',
      'CLUPCN000004',
      'CLUPCN000005',
      'CLUPCN000006',
      'CLUPCN000007',
      'CLUPCN000009',
      'CLUPCN000010',
    ],
  ],
  [
    'Iran wolf',
    [
      'CLUPIR000001',
      'CLUPIR000002',
      'CLUPIR000003',
      'CLUPIR000004',
      'CLUPIR000005',
      'CLUPIR000006',
    ],
  ],
  ['Tajikistan wolf', ['CLUPTJ000003', 'CLUPTJ000005']],
  ['Azerbaijan wolf', ['CLUPAZ000001']],
  ['Eurasia wolf', ['CLUPEA000001']],
  ['Europe wolf', ['CLUPEU000002']],
  ['Kazakhstan wolf', ['CLUPKZ000002']],
]

const AMY2B_ROWS = arrangedSamples(
  AMY2B_GROUPS.flatMap(([label, ids]) =>
    ids.map((name, i) => ({
      name,
      label: ids.length === 1 ? label : `${label} ${i + 1}`,
    })),
  ),
)

// The middle of the widest unbroken run of carriers (Boxer 1 to Alaska village
// dog 3), measured off the capture. Rows 32-61 are non-carrier wolves and paint
// nothing, so a lower arrow points at blank grey.
const AMY2B_CALLOUT_FRAC_Y = 0.23

const CEA_ROWS = arrangedSamples(
  CEA_GROUPS.flatMap(({ label, ids }) =>
    ids.map((name, i) => ({
      name,
      label: ids.length > 1 ? `${label} ${i + 1}` : label,
    })),
  ),
)

// One domain for both halves of dog10k-size-fst-scan, so the zoom's peak is the
// same height as the point it comes from. Autoscaling only one half parts the
// axes.
const FST_DOMAIN_MAX = 0.8
const FST_AXIS = {
  encoding: {
    y: {
      scale: { domainMin: 0, domainMax: FST_DOMAIN_MAX },
      axis: { title: 'Hudson Fst' },
    },
  },
}

const FST_LANE_H = 240

// Px below the track's top edge where a score lands, so a callout sits at a
// peak. wiggle-core's `axisPlotBox` insets the plot 5px at each end, and the
// track element starts 6px above the display.
const fstY = (fst: number, h = FST_LANE_H) =>
  Math.round(6 + (h - 5) - (fst / FST_DOMAIN_MAX) * (h - 10))

// A peak is named from the side at its own height: HMGA2 sits within ~40px of
// the axis top at any lane height, so a pill above it clips. `side` is which
// way the pill hangs.
const fstCallout = (
  trackId: string,
  locus: string,
  text: string,
  fst: number,
  side: 1 | -1 = 1,
) => [
  {
    type: 'text' as const,
    text,
    fontSize: 20,
    leader: true,
    anchor: { trackId, loc: locus, fracY: 0, dy: fstY(fst) },
    dx: side * 150,
  },
]

// The 99.9th percentile of the scan's 11,158 windows, which
// build_dog10k_size_fst.sh prints. Only the 200 kb lane gets it: a quantile
// belongs to its window size, and the 20 kb and per-site lanes are other
// distributions.
const FST_AXIS_RULED = {
  encoding: {
    y: {
      ...FST_AXIS.encoding.y,
      // A rule naming no color draws in the chrome's grey.
      rules: [
        { value: 0.295, color: 'rgb(200,60,60)', label: '99.9th percentile' },
      ],
    },
  },
}

const IGF1_PEAK_WINDOW = 'chr15:41,400,000-41,600,000'

// The 140 kb core the row order is clustered over, and the drawn window.
// dog10k-igf1-haplotype and the video tour both read these.
const IGF1_CLUSTER_CORE = 'chr15:41,440,000-41,580,000'
const IGF1_DRAWN_WINDOW = 'chr15:41,348,000-41,752,000'

// The clustering tour's start: the figure's matrix with no row order yet. The
// Fst lane is left out, since nothing in it moves during the route.
export const dog10kVideoFixtures = {
  config: DOG_CONFIG,
  clusterCore: IGF1_CLUSTER_CORE,
  drawnWindow: IGF1_DRAWN_WINDOW,
  matrixTrackId: 'dog10k_igf1_haplotype',
  unclusteredSession: (loc: string) =>
    lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc,
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          geneGlyphMode: 'representative',
          height: 80,
        },
        {
          trackId: 'dog10k_igf1_haplotype',
          variantLayout: 'columns',
          height: 620,
          lineZoneHeight: 34,
          rowColor: 'size',
        },
      ],
    }),
}

// The submitters' GenBank CDS for each retrocopy; build_dog10k_fgf4_synteny.sh
// fails if either is a `join(...)`.

const RETRO_TRACKS = (genesTrackId: string) => [
  {
    trackId: genesTrackId,
    height: 55,
  },
]

// `parent` and `retro` must be derived together: a retrocopy is 1,066 bp
// shorter than the reference span it covers, so the rows never share a scale.
function fgf4SyntenySession(parent: string, retro: Record<string, string>) {
  return sessionSpec(DOG_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        // Linear: a bezier bows away from the block edges the figure is about.
        mark: { interpolate: 'linear' },
        // 'matches' leaves each intron an unpainted gap. 'full' names the indel
        // op, and the perspective flip swaps D<->I, so one 532 bp gap drew in
        // two colors depending on stacking order.
        indels: { encoding: { opacity: 0 } },
        encoding: { opacity: 0.45 },
        // Level 0 is retro-CFA18 against the parent, level 1 the parent against
        // retro-CFA12.
        tracks: [['dog10k_fgf4_retro_cfa18'], ['dog10k_fgf4_retro_cfa12']],
        views: [
          {
            assembly: 'FGF4retro-CFA18',
            loc: retro['FGF4retro-CFA18']!,
            tracks: RETRO_TRACKS('dog10k_fgf4_retro_cfa18_genes'),
          },
          {
            assembly: 'UU_Cfam_GSD_1.0',
            loc: parent,
            tracks: [
              {
                trackId: 'canFam4_ncbi_refseq',
                height: 60,
              },
              // 330 = 55 rows x 6 px, in fit-to-height mode. Below 6 px a row
              // draws a bare swatch with no name (MIN_TEXT_ROW_HEIGHT).
              {
                trackId: 'dog10k_fgf4_svs',
                type: 'LinearMultiSampleVariantDisplay',
                height: 330,
                rowColor: 'group',
              },
            ],
          },
          {
            assembly: 'FGF4retro-CFA12',
            loc: retro['FGF4retro-CFA12']!,
            tracks: RETRO_TRACKS('dog10k_fgf4_retro_cfa12_genes'),
          },
        ],
      },
    ],
  })
}

export const dog10kSpecs: ScreenshotSpec[] = [
  // Wolfdog local ancestry on chr1, painted by FLARE. The build script removes
  // the eight gray wolves from the reference panel so FLARE paints them as a
  // positive control.
  //
  // Genome-wide needs a FLARE run and a re-upload per chromosome
  // (build_dog10k_wolfdog_ancestry.sh takes one); a `loc` change cannot do it.
  {
    mode: 'url',
    name: 'dog10k-wolfdog-ancestry',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:1-123,556,469',
      tracks: [
        {
          trackId: 'dog10k_wolfdog_named',
          // 64 rows, above the 6px a row label needs.
          height: 700,
          // Rows are haplotype pairs; without separators the row count cannot
          // be read.
          axis: { grid: true },
        },
      ],
    }),
    readyText: 'chr1',
    // The legend renders only once features are binned; canvasDrawn can flip on
    // an empty first paint.
    readySelector: '[data-testid="floating-legend"]',
    readyTimeout: 60000,
    viewportHeight: 905,
    // Row pitch is 700/64 = 10.94px: gray wolves are rows 0-15 and the wolfdogs
    // 16-31. Each `dy` is the baseline of the pill's first line, so a wrapped
    // pill hangs below it; keep both pills one line.
    annotations: [
      {
        type: 'text',
        text: 'Eight gray wolves, left out of the reference panel',
        fontSize: 21,
        maxWidth: 760,
        anchor: {
          trackId: 'dog10k_wolfdog_named',
          loc: WOLFDOG_PILL_X,
          fracY: 0,
          dy: 55,
        },
      },
      {
        type: 'text',
        text: 'Saarloos Wolfdogs: recent wolf introgression',
        fontSize: 21,
        maxWidth: 700,
        anchor: {
          trackId: 'dog10k_wolfdog_named',
          loc: WOLFDOG_PILL_X,
          fracY: 0,
          dy: 250,
        },
      },
    ],
  },

  // dog10k-wolfdog-block-genotypes and its tutorial section were deleted on
  // review. build_dog10k_wolfdog_ancestry.sh still prints the per-edge marker
  // check; do not re-add a figure for it.

  {
    mode: 'url',
    name: 'dog10k-nhej1-cea-deletion',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // The whole NHEJ1 gene and nothing past it; a wider right edge adds a
      // fourth packed gene row the 110px track cannot fit.
      loc: 'chr37:25,510,000-25,596,000',
      // No highlight: the tint washes the het/hom blues against an untinted
      // legend.
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          height: 110,
        },
        // OMIA's record, lifted from CanFam3.1, spans the same deletion the
        // Dog10K genotypes are of.
        {
          trackId: 'omia_dog_variants',
          height: 60,
        },
        {
          trackId: 'dog10k_nhej1_svs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 560,
          ...CEA_ROWS,
          facet: {
            field: 'clade',
            sort: ['Collie clade', 'Other breeds', 'Gray wolf'],
          },
          // The 3,432 bp deletion 4 kb downstream is no-call in the four
          // homozygous Collies and paints a yellow stripe against them. `start`
          // is POS-1.
          filter: [{ field: 'start', equal: 25574004 }],
        },
      ],
    }),
    readyText: 'chr37',
    readyTimeout: 90000,
    viewportHeight: 1024,
    // The pill sits left of the column over lane that paints nothing.
    annotations: [
      {
        type: 'text',
        text: '7.8 kb intron deletion, recessive:\nhomozygotes have Collie eye anomaly',
        fontSize: 22,
        maxWidth: 460,
        anchor: {
          trackId: 'dog10k_nhej1_svs',
          loc: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -704,
          dy: 170,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          trackId: 'dog10k_nhej1_svs',
          loc: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -249,
          dy: 175,
        },
        anchor: {
          trackId: 'dog10k_nhej1_svs',
          loc: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -100,
          dy: 175,
        },
      },
    ],
  },

  // AMY2B: both groups leak. The Arctic breeds stop the reading that sled
  // breeds lack the expansion. build_dog10k_amy2b_sv.sh prints the tally.
  {
    mode: 'url',
    name: 'dog10k-amy2b-duplication',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // Both breakpoints inside the frame, with flank either side.
      loc: 'chr6:47,362,000-47,398,000',
      tracks: [
        // RefSeq names the gene LOC607460, so the pill supplies AMY2B. RNPC3
        // needs the second row.
        {
          trackId: 'canFam4_ncbi_refseq',
          height: 100,
        },
        {
          trackId: 'dog10k_amy2b_svs',
          height: 900,
          ...AMY2B_ROWS,
        },
      ],
    }),
    readyText: 'chr6',
    readyTimeout: 90000,
    // Both halves of dog10k-diet-genes share this height.
    viewportHeight: 1278,
    // The pill sits left of the block over lane that paints nothing.
    annotations: [
      {
        type: 'text',
        text: 'LOC607460 is AMY2B.\nCells mark carriers\nof the duplication.',
        fontSize: 22,
        maxWidth: 300,
        // `textAlign: 'end'` places the pill's right edge, where the arrow
        // leaves.
        textAlign: 'end',
        anchor: {
          trackId: 'dog10k_amy2b_svs',
          loc: 'chr6:47,375,677-47,390,529',
          fracY: AMY2B_CALLOUT_FRAC_Y,
          dx: -430,
          dy: 0,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          trackId: 'dog10k_amy2b_svs',
          loc: 'chr6:47,375,677-47,390,529',
          fracY: AMY2B_CALLOUT_FRAC_Y,
          dx: -420,
          dy: 0,
        },
        anchor: {
          trackId: 'dog10k_amy2b_svs',
          loc: 'chr6:47,375,677-47,390,529',
          fracY: AMY2B_CALLOUT_FRAC_Y,
          dx: -40,
          dy: 0,
        },
      },
    ],
  },

  // RNASE1, the right half of dog10k-diet-genes, from the Zenodo Paragraph set:
  // the Manta set lacks this insertion.
  {
    mode: 'url',
    name: 'dog10k-rnase1-insertion',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // The gene is 1.4 kb; a wider window makes it a sliver.
      loc: 'chr15:18,161,500-18,167,000',
      tracks: [
        // LOC106557526 spans the window, so the gene track needs two rows.
        {
          trackId: 'canFam4_ncbi_refseq',
          height: 100,
        },
        {
          trackId: 'dog10k_rnase1_svs',
          height: 900,
          ...AMY2B_ROWS,
        },
      ],
    }),
    readyText: 'chr15',
    readyTimeout: 90000,
    viewportHeight: 1278,
    // The pill sits at the AMY2B pill's height. The anchor is an insertion
    // mid-way across 5.5 kb, so the dx values differ from the AMY2B part's.
    annotations: [
      {
        type: 'text',
        text: 'LOC475395 is RNASE1.',
        fontSize: 22,
        maxWidth: 300,
        textAlign: 'end',
        anchor: {
          trackId: 'dog10k_rnase1_svs',
          loc: 'chr15:18,164,072-18,164,074',
          fracY: 0.62,
          dx: -180,
          dy: 0,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          trackId: 'dog10k_rnase1_svs',
          loc: 'chr15:18,164,072-18,164,074',
          fracY: 0.62,
          dx: -170,
          dy: 0,
        },
        anchor: {
          trackId: 'dog10k_rnase1_svs',
          loc: 'chr15:18,164,072-18,164,074',
          fracY: 0.62,
          dx: -8,
          dy: 0,
        },
      },
    ],
  },

  // Stacked, the same animals in the same order in both halves. Side by side,
  // the 6048 px composite drew its row labels at about 3 px in the page column.
  {
    mode: 'compose',
    name: 'dog10k-diet-genes',
    parts: ['dog10k-amy2b-duplication', 'dog10k-rnase1-insertion'],
  },

  // Hudson Fst per 200 kb window between toy/small and giant animals, as a
  // GWASTrack whose score column is Fst (`scoreTransform: 'none'`).
  {
    mode: 'url',
    name: 'dog10k-size-fst-scan-genome',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // The scan is autosomal, so chrX would be an empty lane.
      displayedRegionNames: Array.from({ length: 38 }, (_, i) => `chr${i + 1}`),
      tracks: [
        {
          trackId: 'dog10k_size_fst',
          height: FST_LANE_H,
          ...FST_AXIS_RULED,
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    viewportHeight: 460,
    // chr10 takes thirteen of the top fourteen windows, so each label sits on
    // the highest window overlapping its gene. The scores are the drawn
    // points', read off the capture; fstCallout turns them into heights.
    annotations: [
      ...fstCallout(
        'dog10k_size_fst',
        'chr10:8,600,000-8,800,000',
        'HMGA2',
        0.738,
      ),
      ...fstCallout('dog10k_size_fst', IGF1_PEAK_WINDOW, 'IGF1', 0.367),
      // chr34 sits against the view's right edge.
      ...fstCallout(
        'dog10k_size_fst',
        'chr34:18,600,000-18,800,000',
        'IGF2BP2',
        0.287,
        -1,
      ),
    ],
  },

  // The IGF1 zoom, on the same axis as the whole-genome half.
  {
    mode: 'url',
    name: 'dog10k-size-fst-scan-igf1',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr15:40,600,000-42,600,000',
      highlight: [IGF1_PEAK_WINDOW],
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          geneGlyphMode: 'representative',
          displayMode: 'compact',
          height: 90,
        },
        {
          // A 20 kb rebin over this window (build_dog10k_size_fst.sh
          // WINDOW=20000). At 10 kb the peak windows fall to the MIN_SITES=20
          // floor and a quarter of the windows drop out.
          trackId: 'dog10k_size_fst_igf1_20kb',
          height: FST_LANE_H,
          // At 9 px the rules merge into a band.
          marks: [{ mark: 'rule', encoding: { y: 'score', strokeWidth: 6 } }],
          ...FST_AXIS,
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    viewportHeight: 576,
    annotations: [
      {
        type: 'text',
        text: 'IGF1',
        fontSize: 20,
        anchor: {
          trackId: 'dog10k_size_fst_igf1_20kb',
          loc: IGF1_PEAK_WINDOW,
          fracY: 0,
          dy: 30,
        },
      },
    ],
  },

  // The trapezoid's narrow end is solved for: chr15 is under 3 px of the
  // whole-genome row, so 0.5% off lands on another chromosome. L and W come
  // from a least-squares fit over the row's own region dividers:
  //
  //   x = L + f * W  ->  L = 12.5, W = 2975.8  (3000 px wide)
  //
  // popgen/in2lt_inversion's independent fit agrees. Re-derive by fitting the
  // columns dark across the score band against the cumulative shares in
  // UU_Cfam_GSD_1.0.chrom.sizes.
  {
    mode: 'compose',
    name: 'dog10k-size-fst-scan',
    parts: ['dog10k-size-fst-scan-genome', 'dog10k-size-fst-scan-igf1'],
    gutter: 120,
    annotations: [
      {
        type: 'trapezoid',
        fromAnchor: {
          selector: '[data-part="0"]',
          fracX: [0.52108, 0.52198],
        },
        anchor: { selector: '[data-part="1"]' },
      },
    ],
  },

  // The FGF4 retrogene. A retrocopy's reads pile onto the parent's exons, so
  // Manta calls a deletion of each intron; build_dog10k_fgf4_retrogene.sh
  // asserts both records' spans against the RefSeq introns. The ribbons align
  // the two deposited retrocopies (MF040222, MF040221) back to the parent, and
  // build_dog10k_fgf4_synteny.sh asserts their gaps are the introns.
  //
  // Positional, not a matrix: the claim is that the two blocks land in the gene
  // model's two gaps. Row labels and swatches come from the adapter's
  // `samplesTsvLocation`; the swatch is body shape, never genotype.
  //
  // Three levels with the parent in the middle, since as two regions of one row
  // the retrocopies' ribbons would cross.
  {
    mode: 'url',
    name: 'dog10k-fgf4-retrogene-synteny',
    // 48,872,890 is where the CFA18 alignment ends. The retrocopy ranges come
    // from walking each PAF's CIGAR; a row showing more trails ribbon-free
    // sequence.
    url: fgf4SyntenySession('chr18:48,869,100-48,872,900', {
      'FGF4retro-CFA18': 'FGF4retro-CFA18:1-2625',
      'FGF4retro-CFA12': 'FGF4retro-CFA12:2-2639',
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    viewportHeight: 1128,
    annotations: [
      {
        type: 'text' as const,
        fontSize: 18,
        maxWidth: 320,
        text: 'retrogene - no introns (CFA18)',
        anchor: {
          view: [0, 0],
          trackId: 'dog10k_fgf4_retro_cfa18_genes',
          loc: 'FGF4retro-CFA18:1',
          fracY: 1,
          dx: 14,
          dy: -26,
        },
      },
      {
        type: 'text' as const,
        fontSize: 18,
        maxWidth: 320,
        text: 'regular gene (dog reference)',
        anchor: {
          view: [0, 1],
          trackId: 'canFam4_ncbi_refseq',
          loc: 'chr18:48,869,100',
          fracY: 1,
          dx: 14,
          dy: -26,
        },
      },
      {
        type: 'text' as const,
        fontSize: 18,
        maxWidth: 320,
        text: 'retrogene - no introns (CFA12)',
        anchor: {
          view: [0, 2],
          trackId: 'dog10k_fgf4_retro_cfa12_genes',
          loc: 'FGF4retro-CFA12:2',
          fracY: 1,
          dx: 14,
          dy: -26,
        },
      },
    ],
  },

  // No whole-collection figure for `dog10k_fgf4_cohort_svs`: 1,879 rows in 520
  // px alias, so stripe density misstates the carrier rate.

  // CYP1A2's nonsense variant (Meadows et al. 2023, Fig 10), position derived
  // by translating the reference CDS. No wolf or coyote in the collection
  // carries it.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-nonsense',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // At base level a per-sample SNV call reads as a block.
      loc: 'chr30:38,261,590-38,261,690',
      // colorByFrame paints the translation rows in the gene track's CDS
      // palette, so the coding frame matches the gene's pink. A view prop, not
      // a display one.
      colorByFrame: true,
      // No highlight: the tint washes the het/hom blues against an untinted
      // legend.
      tracks: [
        {
          trackId: 'UU_Cfam_GSD_1.0-ReferenceSequenceTrack',
          forward: { show: true },
          reverse: { show: false },
          translation: { show: true },
          height: 80,
        },
        {
          trackId: 'canFam4_ncbi_refseq',
          height: 60,
        },
        {
          trackId: 'dog10k_cyp1a2_snvs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 500,
          ...CYP_ROWS,
          // Only the stop-gained site: every wolf here carries 38,261,650, and
          // an unfiltered column would put a full wolf row beside the claim.
          // `start` is POS-1.
          filter: [{ field: 'start', equal: 38261634 }],
        },
      ],
    }),
    readyText: 'chr30',
    readyTimeout: 90000,
    viewportHeight: 951,
    annotations: [
      {
        type: 'text',
        text: 'CGA → TGA (Arg373 → stop)\nhomozygotes make no CYP1A2:\npoor drug metabolizers',
        fontSize: 22,
        anchor: {
          trackId: 'dog10k_cyp1a2_snvs',
          loc: 'chr30:38,261,637',
          fracY: 0,
          // Right of the genotype column, over homozygous-reference grey.
          dx: 24,
          dy: 26,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          trackId: 'dog10k_cyp1a2_snvs',
          loc: 'chr30:38,261,637',
          fracY: 0,
          dx: 24,
          dy: 14,
        },
        anchor: {
          trackId: 'UU_Cfam_GSD_1.0-ReferenceSequenceTrack',
          loc: 'chr30:38,261,636',
          fracY: 1,
        },
      },
    ],
  },

  // `dog10k_cyp1a2_cn` has no figure: its fifteen CRAMs are an arbitrary set of
  // dogs, and the cohort painting below covers every canid.

  // CYP1A2 copy number across the collection, from SNV-callset DP against each
  // dog's own flank depth, rounded per window. 5 kb windows stepped by 1 kb:
  // narrower windows speckle the flat baseline (build_dog10k_cyp1a2_cn.sh).
  // Clustered on the whole profile, so bands are element extents.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-cohort-copy-number',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr30:38,210,000-38,395,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          height: 90,
        },
        {
          // The CpG island explains the white stripe through every row at
          // chr30:38,289,000-38,293,000: a dropped window paints nothing. See
          // MINUNIQUE in scripts/build_dog10k_cyp1a2_cn.sh.
          trackId: 'dog10k_cyp1a2_cpg',
          // Two rows: the labels collide before the islands do.
          height: 62,
        },
        {
          trackId: 'dog10k_cyp1a2_breed_cn',
          height: 380,
        },
        {
          trackId: 'dog10k_cyp1a2_cohort_cn',
          height: 300,
          runClustering: true,
          // No breed swatch: the four named groups are ~10 px of this lane, and
          // `facet: 'group'` pulls them out of the clustered order.
        },
      ],
    }),
    readyText: 'chr30',
    // The dendrogram lands last; the row labels appear while rows are still in
    // file order.
    readySelector:
      'body:has([data-testid="tree_sidebar_dendrogram"]) [data-testid="mark-row-labels"]',
    readyTimeout: 180000,
    viewportHeight: 1162,
  },

  // The IGF1 haplotype as a clustered genotype matrix over 167 canids. The
  // matrix gives every SNV one column, so shared alleles form a solid band.
  //
  // `clusterRegion` orders rows on the 140 kb differentiated core whatever is
  // drawn. The build's VCF and Fst BED stop at chr15:41,350,031-41,749,214, so
  // a wider frame paints flank with no data.
  //
  // Stays clustered: grouping by size assumes what clustering shows.
  {
    mode: 'url',
    name: 'dog10k-igf1-haplotype',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: IGF1_DRAWN_WINDOW,
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          // The same glyph mode as dog10k-size-fst-scan-igf1 above it on the
          // page.
          geneGlyphMode: 'representative',
          height: 80,
        },
        // Per-site Hudson Fst over the matrix's own VCF: each point is one
        // column.
        {
          trackId: 'dog10k_igf1_fst',
          height: 150,
          ...FST_AXIS,
        },
        {
          trackId: 'dog10k_igf1_haplotype',
          variantLayout: 'columns',
          height: 620,
          lineZoneHeight: 34,
          runClustering: true,
          clusterRegion: IGF1_CLUSTER_CORE,
          rowColor: 'size',
        },
      ],
    }),
    readyText: 'chr15',
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 120000,
    // Below ~2px a matrix row becomes a hairline; 620 is 3.7px a row.
    viewportHeight: 1135,
  },
]
