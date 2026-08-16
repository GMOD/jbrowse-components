import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the four Dog10K tutorials (local_ancestry.md, dog10k_svs.md,
// dog10k_lof.md, dog10k_selection.md). All read
// test_data/dog10k/config.json, whose data is built by the scripts/build_dog10k_*
// scripts: _wolfdog_ancestry, _nhej1_sv, _cyp1a2, _cyp1a2_cn, _slc28a3_cn,
// _igf1, _size_fst, _fgf4_retrogene and _fgf4_synteny.

const DOG_CONFIG = 'test_data/dog10k/config.json'

// Where the four local-ancestry pills start on the x axis. They name bands of
// rows rather than loci, so this is a place to put a label and nothing else: one
// shared value so they left-align into a single column instead of reading as
// four unrelated marks.
//
// It has to clear ~220px, which is NOT the left edge of the data: a
// LinearMultiRowFeatureDisplay draws its row labels as a translucent overlay on
// top of its own painting, so the blocks run all the way to x=0 under them and a
// locus that looks like it lands in empty margin actually lands on the names. 6
// Mb put every pill over the labels. 20 Mb clears them.
const WOLFDOG_PILL_X = 'chr1:20,000,000'

// Row labels for the NHEJ1 SV figure, grouped so the Collie-clade breeds that
// carry the deletion sit together above the breeds and wolves that do not. IDs
// are the VCF's own, in its own order (the build script writes them); the swatch
// marks the group and only the label is cosmetic.
const CEA_GROUPS = [
  {
    label: 'Collie',
    color: '#0072B2',
    ids: Array.from(
      { length: 13 },
      (_, i) => `COLL0000${String(i + 1).padStart(2, '0')}`,
    ),
  },
  {
    label: 'Shetland Sheepdog',
    color: '#0072B2',
    ids: ['SSHP000001', 'SSHP000002', 'SSHP000003', 'SSHP000004'],
  },
  {
    label: 'Lancashire Heeler',
    color: '#0072B2',
    ids: ['LANC000001', 'LANC000002', 'LANC000003', 'LANC000004'],
  },
  {
    label: 'Silken Windhound',
    color: '#0072B2',
    ids: ['SKWH000001', 'SKWH000002'],
  },
  {
    label: 'Australian Shepherd',
    color: '#999999',
    ids: ['AUSS000001', 'AUSS000002', 'AUSS000003'],
  },
  {
    label: 'German Shepherd',
    color: '#999999',
    ids: ['GRSD000002', 'GRSD000003'],
  },
  {
    label: 'Labrador Retriever',
    color: '#999999',
    ids: ['LABR000001', 'LABR000002', 'LABR000003', 'LABR000004'],
  },
  {
    label: 'Wolf',
    color: '#E69F00',
    ids: ['CLUPGR000001', 'CLUPGR000002', 'CLUPGR000003', 'CLUPGR000004'],
  },
]

// Row labels for the CYP1A2 figure. Breeds carrying the nonsense allele first,
// then two that do not, then the wolves — which is where the control lives: no
// wolf or coyote in the whole collection carries it.
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

const CYP_LAYOUT = CYP_GROUPS.flatMap(({ label, color, n, prefix, from = 1 }) =>
  Array.from({ length: n }, (_, i) => ({
    name: `${prefix}${String(from + i).padStart(6, '0')}`,
    label: `${label} ${i + 1}`,
    color,
  })),
)

// Row labels for the AMY2B figure, in the order build_dog10k_amy2b_sv.sh writes
// the slice. Ids are spelled out rather than derived from a prefix and a count
// the way CYP_GROUPS does them, because two of these runs have holes in them:
// there is no CLUPCN000008 in the callset, and the Tajikistan wolves are 3 and 5
// with 4 and 6 in the sample table but not in the header.
//
// A `layout` replaces the sidebar sources wholesale, so supplying only labels
// left every row with no color and took the swatch column away with it. The
// group and its color are therefore repeated here, matching the `group` column
// of dog10k_amy2b_samples.tsv that the track's `colorBy` reads. Wolves are
// labelled by country, because which countries the five carriers come from is
// the reading this panel supports.
const AMY2B_COLORS: Record<string, string> = {
  'Breed dog': '#0072B2',
  'Village dog': '#009E73',
  'Gray wolf': '#E69F00',
}

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

const AMY2B_LAYOUT = AMY2B_GROUPS.flatMap(([label, ids]) => {
  const group = label.endsWith(' wolf')
    ? 'Gray wolf'
    : label.includes('village')
      ? 'Village dog'
      : 'Breed dog'
  return ids.map((name, i) => ({
    name,
    label: ids.length === 1 ? label : `${label} ${i + 1}`,
    group,
    color: AMY2B_COLORS[group],
  }))
})

// Where the AMY2B pill and its arrow sit in the 86-row lane. It was 0.62,
// which is blank: the lane holds one record, so a row is painted only where
// that animal carries it, and rows 32 to 61 of this order are wolves that do
// not (review: "arrow on left side of the screen points at blank grey space").
// 0.23 is the middle of the widest unbroken run of carriers, the 13 rows from
// Boxer 1 to Alaska village dog 3, so the head lands on ink with ~75px of
// margin either way. Measured off the capture rather than derived from the row
// order: the lane's painted bands are at image y 826-1057, 1098-1371 and three
// slivers below, against a track top of 822 and a height of 1800 image px.
//
// The pill needs no such care -- nothing paints left of the duplication's left
// breakpoint at any row, which is why it sits there.
const AMY2B_CALLOUT_FRAC_Y = 0.23

const CEA_LAYOUT = CEA_GROUPS.flatMap(({ label, color, ids }) =>
  ids.map((name, i) => ({
    name,
    label: ids.length > 1 ? `${label} ${i + 1}` : label,
    color,
  })),
)

// One score domain for both halves of dog10k-size-fst-scan, so the peak the
// zoom draws is the same height as the point it comes from. 0.8 is what the
// whole-genome half gets from autoscale anyway (build_dog10k_size_fst.sh prints
// the top windows; the highest is chr10's), and writing it down is what keeps
// the two axes from parting company when only one of them is autoscaled.
const FST_AXIS = { minScore: 0, maxScore: 0.8 }

// Both halves of dog10k-size-fst-scan are 240px where they were 380 (review:
// "make both figures shorter in y-axis real estate space"). What each lane is
// read for is a RATIO -- three named peaks against a dense band, and the same
// peak against its neighbours -- and a ratio survives a third off the height.
const FST_LANE_H = 240

// Where a score lands, in px below the TRACK's own top edge, so a callout can be
// placed at a peak without anyone measuring the capture again. `fracY` cannot
// say "at this score", and the hand-fitted `dy` numbers this replaces were the
// one thing in the pair that a height change silently broke.
//
// Two terms, both from the app rather than from a ruler. wiggle-core's
// `axisPlotBox` insets the plot by YSCALEBAR_LABEL_OFFSET at each end, so the
// domain spans `h - 10` px starting `h - 5` up from the display's top; the
// track element then starts 6px above the display. Checked against the previous
// capture's own numbers, where all three peaks land within 6px of where its
// hand-fitted offsets put them.
const fstY = (fst: number, h = FST_LANE_H) =>
  Math.round(6 + (h - 5) - (fst / FST_AXIS.maxScore) * (h - 10))

// A peak is named from the SIDE, at its own height, rather than from above it.
// `side` is which way the pill hangs: the two loci near the middle of the row
// have room on their right, chr34 sits against the frame edge and does not.
//
// Sideways because the tallest peak has no room above it at any lane height --
// HMGA2 sits within ~40px of the axis top whatever `h` is, since it is nearly
// the axis maximum -- so a pill placed above it is clipped by the shrink that
// leaves every other one alone. At the peak's own y the three callouts also
// stack in score order, which is the reading.
//
// ONE ANNOTATION, not a pill plus an arrow. The pair was three hand-written
// offsets whose spacing only worked at one label length: IGF1 is short and its
// arrow ended 50px shy of the pill, IGF2BP2 is long and its pill swallowed the
// tail. `leader` takes the tail off the measured pill instead, so 150 is the gap
// every callout in the lane keeps whatever it says.
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
    anchor: { track: trackId, locus, fracY: 0, dy: fstY(fst) },
    dx: side * 150,
  },
]

// The scan carries no p-value, so what counts as a peak is empirical: this is
// the 99.9th percentile of the scan's own 11,158 scored windows, which
// build_dog10k_size_fst.sh now prints beside its top-20 table so the number can
// be re-derived rather than taken from here.
//
// The 99.9th rather than the 99th (0.13) because the 99th sits inside the top of
// the dense band and reads as a ceiling on the noise; at 0.29 the line separates
// the labelled loci from everything else, which is what a reader wants to know.
//
// ONLY THE 200 kb LANE GETS IT, and that is not an oversight. A quantile is a
// property of the distribution it was taken from, and window size sets that
// distribution's spread: the same panel rebinned to 20 kb scores far more
// windows off far fewer sites each, so its noise reaches higher and this line
// would sit somewhere arbitrary inside it. The per-site IGF1 lane is a third
// distribution again. Each would need its own quantile off its own windows, and
// none of the three is the axis-sharing case FST_AXIS is.
const FST_SIGNIFICANCE = { significanceLine: 0.295 }

// The IGF1 peak window, which the zoom half marks and the tutorial's next
// figure slices. One 200 kb bin of the scan.
const IGF1_PEAK_WINDOW = 'chr15:41,400,000-41,600,000'

// What a retrocopy row carries: the submitters' own annotation of the deposited
// record, which is the figure's claim restated in the form a reader already knows
// how to read -- the parent's CDS is three boxes and this is one. It is GenBank's
// feature table, not a prediction of ours; build_dog10k_fgf4_synteny.sh fails if
// either CDS is a `join(...)`, the shape a processed retrocopy cannot have.
//
// A sequence track under it was the first version, from when the annotation did
// not exist and the row needed anything at all to stay off the "No tracks active"
// empty state. Dropped once the annotation landed: at 1 bp/px it was base-colored
// stripes, the most saturated thing in the frame and the least informative, and it
// sat directly against the synteny bands competing with the ribbons. Bases are a
// zoom away in the live link.

const RETRO_TRACKS = (genesTrackId: string) => [
  {
    trackId: genesTrackId,
    type: 'LinearBasicDisplay',
    height: 55,
  },
]

// The retrocopy-vs-parent synteny session. `parent` is the chr18 window and
// `retro` the corresponding sub-range of each retrocopy, which have to be derived
// together: a retrocopy is 1,066 bp shorter than the reference span it covers, so
// the two rows can never share a scale, and a row showing more or less than its
// alignment covers would put ribbon-free sequence in the frame.
function fgf4SyntenySession(parent: string, retro: Record<string, string>) {
  return sessionSpec(DOG_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        // straight quadrilaterals, not drawCurves: a bezier bows away from its
        // own endpoints, and the whole figure is where four block edges sit
        // against two intron boundaries
        drawCurves: false,
        // 'matches', so each intron is an unpainted gap in the ribbon rather
        // than a colored wedge. NOT a cosmetic choice: 'full' names each indel
        // op, and the perspective-flip swaps D<->I, so the SAME 532 bp gap came
        // out as a yellow deletion above the parent row and a blue insertion
        // below it -- one event in two colors, decided by stacking order.
        // Unpainted is symmetric, and "the retrocopy has nothing here" is the
        // claim anyway. It also drops the slivers the 1-6 bp indels drew.
        cigarMode: 'matches',
        alpha: 0.45,
        // 2-D form, one entry per adjacent pair: level 0 is retro-CFA18 against
        // the parent, level 1 the parent against retro-CFA12
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
                type: 'LinearBasicDisplay',
                height: 60,
              },
              // The 55-row multi-sample display, per review, rather than the
              // one-row positional display this used to carry. It draws each
              // record at its real coordinates the same way, so the geometry the
              // figure is about (a block edge on an intron boundary) survives the
              // swap, and every row now also says which breeds carry the record.
              // The cost is real and was the reason for the earlier choice: it
              // puts ~690 px between the two synteny bands, so the upper ribbon
              // and the lower one can no longer be taken in at once.
              //
              // `showVariantLane` is the other half of that review ("there
              // should be a linearvariantdisplay of same data multivariantdisplay
              // is showing"): the matrix answers WHO carries a record and the
              // lane answers WHAT the records are, the two boxes the whole figure
              // is about, and reading the matrix without it means inferring the
              // record from a column of genotypes.
              //
              // It used to take a SECOND trackId over the same VCF, because one
              // track opens once per view — two `tracks` entries with one
              // trackId silently keeps the last, and the frame came back with
              // the one-row lane where the matrix should have been. The lane is
              // a band inside this display now, so there is nothing to
              // duplicate: one track, one fetch, and the marks sit in the same
              // box as the columns they name. It also gives ~50 px back to the
              // gap between the two synteny bands.
              // AS SHORT AS THE LABELS ALLOW (review: "decrease height of the
              // multisamplevariantdisplay as much as possible so that labels
              // still show"), and the floor is the app's own, not a taste:
              // `rowLabelsCarryText` draws a row's NAME at 6 px and a bare
              // colour swatch below that (MIN_TEXT_ROW_HEIGHT), and this
              // display is in fit-to-height mode, so its row height is
              // `(height - variant lane) / 55`. 370 = 55 x 6 + the 40 px lane,
              // which is the smallest height whose rows still name their breed.
              // It was 690, i.e. 11.8 px a row -- and every one of those extra
              // px sat between the two synteny bands the figure exists to
              // compare, which is the cost the earlier note flagged when the
              // matrix replaced the one-row display.
              {
                trackId: 'dog10k_fgf4_svs',
                type: 'LinearMultiSampleVariantDisplay',
                height: 370,
                colorBy: 'group',
                showVariantLane: true,
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
  // Dog10K wolfdog local ancestry, chr1: 22 haplotype rows painted by FLARE
  // against European gray wolf and breed-dog reference panels. Four Saarloos and
  // four Czechoslovakian Wolfdogs (both 20th-century German Shepherd x captive
  // wolf crosses) carry wolf blocks; the German Shepherd is the control, and the
  // Shiloh Shepherd and Tamaskan are the two breeds the Dog10K paper's allele
  // sharing / lookalike discussion raises. Built by
  // scripts/build_dog10k_wolfdog_ancestry.sh.
  //
  // NO BOX IS DRAWN ON IT, AND NONE SHOULD BE. It used to carry the genotype
  // window as an in-app highlight plus a callout naming the block edges inside
  // it, and a red box over 1.2% of the frame reads as "something happens here"
  // whatever the label says, when what is inside it is an ordinary window picked
  // for being checkable (review: "if we are making up a story we should not do
  // that ... i just wanted to show ancestry painting").
  //
  // TWO PILLS, ON THE TWO BANDS THAT ARE NOT SELF-EVIDENT. There were four, one
  // per band, and the two that went are the two whose row labels already said
  // the same thing: "219 breeds with no wolf story: flecks, not blocks" over a
  // field of flecks, and "German Shepherd lineage: solid dog" over rows the
  // sidebar names German Shepherd (review: "remove german shepherd and 219
  // breeds note"). A pill that repeats the sidebar spends a band of rows to say
  // nothing.
  //
  // The wolfdog pill names Saarloos only and says what the blocks ARE rather
  // than how big they are (review: "the saarloos speaks for its own, just say
  // saarloos recent wolf ancestry ... very brief, very clear"). Megabase-long
  // blocks IS recent introgression — the length is the evidence, not the claim
  // — and the Czechoslovakian rows directly under it show the same pattern
  // under their own labels.
  //
  // "HELD OUT" IS GONE FROM THE PILL (review: "unclear what term 'held out'
  // means here"). It is a term about the panel, not about the animals: the
  // build script REMOVES these eight from the wolf reference panel so FLARE has
  // to paint them like anything else, which makes them the figure's positive
  // control. The pill now says that instead of naming it. local_ancestry.md
  // still uses the term, where it is defined.
  //
  // Each pill names a BAND OF ROWS, not a locus, which is why neither is a box:
  // the y carries the meaning (fracY 0 plus a dy, so a pill tracks its band if
  // the row count or track height changes) and the x is only a place to put the
  // label. Anchored at 6 Mb so both left-align into one column.
  //
  // "IF GENOME WIDE THERE ARE INTERESTING PATTERNS, WE CAN CONSIDER ZOOMING OUT
  // GENOME WIDE" (same review). Not available as a spec edit, and not because of
  // the display. scripts/build_dog10k_wolfdog_ancestry.sh takes ONE chromosome
  // (`CHROM="${1:-chr1}"`) and every step after it is per-chromosome: the panel
  // slice, the genetic map, the FLARE run, the BED. The hosted files are
  // dog10k_wolfdog_named.chr1.bed and dog10k_wolfdog_ancestry.chr1.bed. Genome
  // wide is 38 more FLARE runs over ~20x the sequence, then a re-upload of the
  // demo, so it is a build-and-host job to be asked for rather than a loc
  // change. Worth noting before anyone costs it out: chr1 is where the block
  // structure is legible at all, and the same rows at 1/20th the bp per pixel
  // would be flecks.
  {
    mode: 'url',
    name: 'dog10k-wolfdog-ancestry',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:1-123,556,469',
      tracks: [
        {
          trackId: 'dog10k_wolfdog_named',
          type: 'LinearMultiRowFeatureDisplay',
          // 64 rows. Above the 6px a row label needs, which is the whole reason
          // this figure exists next to the 486-row one below it.
          height: 700,
          // Rows are haplotypes, two per animal, and most of this painting is
          // one dog color running edge to edge — so without a line the row
          // count cannot be read off the image, and neither can which pair of
          // rows belongs to which name in the sidebar. The clustered figure
          // below is at ~2.3px a row and deliberately does NOT set this (below
          // MIN_SEPARATOR_ROW_PX the lines would be the figure).
          showRowSeparators: true,
        },
      ],
    }),
    readyText: 'chr1',
    // gate capture on the data-driven color legend (renders only once features
    // have loaded + been binned), not just canvasDrawn/settle: canvasDrawn can
    // flip on an empty first paint, so under a slow first-fetch a fixed settle
    // could capture the track before the painting appears
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 60000,
    settleMs: 3000,
    // all 64 haplotype rows plus the color legend, no page background below
    viewportHeight: 905,
    // Row pitch is 700px / 64 rows = 10.94px, and the two bands the pills name
    // are rows 0-15 (the gray wolves) and 16-31 (the eight wolfdogs,
    // Czechoslovakian 2 excepted, plus the Shiloh Shepherd); the two unlabelled
    // bands below them are the 219-breed sweep (32-51) and the German Shepherd
    // lineage (52-63). Each dy is a row index times that pitch, and it is the
    // baseline of the pill's FIRST line, so a wrapped pill hangs ~52px BELOW the
    // number written here and has to be placed against the bottom of its band,
    // not the middle of it.
    //
    // Both pills are one line, so `maxWidth` is a ceiling neither reaches and
    // each `dy` is where that single line sits inside its band rather than where
    // a wrapped block has to start to end inside it. The wolf pill grew by half
    // its length when "held-out" became what held-out means, so its ceiling went
    // up with it — at 600 it wrapped onto the rows it labels.
    annotations: [
      {
        type: 'text',
        text: 'Eight gray wolves, left out of the reference panel',
        fontSize: 21,
        maxWidth: 760,
        anchor: {
          track: 'dog10k_wolfdog_named',
          locus: WOLFDOG_PILL_X,
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
          track: 'dog10k_wolfdog_named',
          locus: WOLFDOG_PILL_X,
          fracY: 0,
          dy: 250,
        },
      },
    ],
  },

  // dog10k-wolfdog-ancestry-clustered was here and is DELETED (review: "you can
  // consider deleting"). It was the same FLARE painting over all 243 animals,
  // clustered, and 193 of the 219 breeds come in under 1% wolf on chr1 — so
  // roughly two thirds of a 2,610px capture was an unbroken dog-blue field whose
  // only content was that null result. The named-animals figure above it already
  // carries the spectrum with rows a reader can name, and the clustering
  // capability is shown in dog10k-igf1-haplotype. What the deleted figure knew
  // that nothing else did is now prose in local_ancestry.md: the clustering has
  // no access to the breed names and still separates the wolf carriers, and its
  // corner chip names the region the tree came from because clustering is
  // region-scoped.

  // dog10k-wolfdog-block-genotypes was here and is DELETED (review: "i dont
  // understand this figure. i'd just suggest deleting"). The previous pass had
  // already offered exactly this, and its argument for keeping it does not
  // survive a second reader not following the picture: three lanes at two
  // different row pitches, where reading it at all meant counting down from the
  // top of one lane to match a row in the other.
  //
  // THE WHOLE SECTION WENT WITH IT on the follow-up ("yes delete that section
  // too"), so local_ancestry.md no longer carries the block-edge check as a
  // section, the quoted count table, or the jexl marker filter. Note this
  // deliberately spends the tutorial convention that a page ends by checking its
  // inference against the raw data (website/docs/tutorials/CLAUDE.md): the check
  // now survives only as two sentences under Reproduce it end to end, pointing
  // at what the build script prints. Do not re-add a figure for it.
  //
  // The check still exists offline and is worth knowing before anyone re-derives
  // it: build_dog10k_wolfdog_ancestry.sh writes a genotype slice of
  // chr1:112,000,000-113,500,000 and prints, per painted block edge, how many
  // ancestry-informative markers a haplotype carries either side. Three of the
  // four wolfdog edges are exact (23/23 wolf alleles then 0/26 for both
  // haplotypes whose wolf block ends at 112,579,995 -- the last wolf-called
  // marker is 112,576,175 and the runs tile to the first dog-called one, with
  // no informative marker in between -- and 41/43 then 0/6 for Saarloos 1 hap1),
  // the five sweep-breed edges are not (13/23 for the Chow Chow and the Kai Ken,
  // and the Thai Ridgeback's block ends before the first marker), and Saarloos 2
  // hap2 at 3/5 then 6/44 is a real drop that is not a coordinate. The lane that
  // drew it needed AF_wolf >= 0.8 && AF_dog <= 0.15 as a jexl filter, over
  // frequencies the script wrote per site across the FULL panels rather than
  // across the 32 animals in the slice; unfiltered it is every common site in
  // 1.5 Mb and reads as salt-and-pepper.

  // The Collie eye anomaly deletion (Schall & Kidd 2025, Fig 9): a 7.8 kb
  // deletion inside an NHEJ1 intron, genotyped across breeds from the Dog10K
  // SV callset. The Collie-clade breeds carry it, including homozygotes; the
  // other breeds and the wolves do not. Gene track above so the deletion is
  // visibly intronic. Built by scripts/build_dog10k_nhej1_sv.sh.
  {
    mode: 'url',
    name: 'dog10k-nhej1-cea-deletion',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // The whole NHEJ1 gene (chr37:25,513,157-25,595,616 in canFam4 RefSeq) and
      // nothing past it, so the deletion is visibly inside an intron. The old
      // right edge at 25,600,000 reached into SLC23A3/LOC111094448, which added
      // a fourth packed row the 110px gene track could not fit -- so the capture
      // carried the track's overflow/resize widget and a half-cut gene label.
      loc: 'chr37:25,510,000-25,596,000',
      // No view highlight over the deletion: it is the only record the lane
      // draws, so nothing needs pointing at, and the tint would wash the het/hom
      // blues into teal and olive against an untinted legend.
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 110,
        },
        // OMIA's own record of this variant, from a source that is not the
        // callset ("if we have clinvar or omia dog variants would be
        // interesting", review). Its span is the check: OMIA published the CEA
        // deletion on CanFam3.1 as g.25698028_25705826del, and lifted to canFam4
        // that is chr37:25,574,007-25,581,807, which is the deletion the Dog10K
        // genotypes below are of (POS 25,574,005, the anchor base ahead of it).
        // Two independent sources, one bar. The description under the label is
        // the mode of inheritance, which is what makes the dark cells below
        // affected rather than merely homozygous.
        {
          trackId: 'omia_dog_variants',
          type: 'LinearBasicDisplay',
          height: 60,
        },
        {
          trackId: 'dog10k_nhej1_svs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 560,
          layout: CEA_LAYOUT,
          // The window holds nine SV records, and unfiltered they defeat the
          // figure: the 3,432 bp deletion 4 kb downstream is no-call in exactly
          // the four Collies homozygous for this one (its region is gone, so it
          // cannot be genotyped), so it paints a yellow stripe hard against the
          // darkest blue and the pair reads as one striped block rather than as
          // one deletion. `start` is POS-1.
          jexlFilters: ["jexl:get(feature,'start') == 25574004"],
        },
      ],
    }),
    readyText: 'chr37',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track, the OMIA lane, all 36 sample rows and the genotype legend
    viewportHeight: 1003,
    // What the deletion does, beside the column that carries it. The legend can
    // say "homozygous alt" but not that homozygous is the affected state: CEA is
    // recessive (Parker et al. 2007; OMIA 000218-9615), so the dark cells are
    // affected animals and the light ones are unaffected carriers, which is the
    // difference between the two blues a reader cannot otherwise infer. It names
    // the disease rather than deferring to the OMIA lane for it (review): the
    // pill is what a reader looks at, and Collie eye anomaly is the thing they
    // will already know. The pill sits left of the column, over lane that paints
    // nothing (the filtered track has one record), so no cell is covered.
    annotations: [
      {
        type: 'text',
        text: '7.8 kb intron deletion, recessive:\nhomozygotes have Collie eye anomaly',
        fontSize: 22,
        maxWidth: 460,
        anchor: {
          track: 'dog10k_nhej1_svs',
          locus: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -704,
          dy: 170,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dog10k_nhej1_svs',
          locus: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -249,
          dy: 175,
        },
        anchor: {
          track: 'dog10k_nhej1_svs',
          locus: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -100,
          dy: 175,
        },
      },
    ],
  },

  // The pancreatic amylase duplication, genotyped across dogs and every wolf in
  // the callset. The other kind of variant on the page: NHEJ1 is rare and
  // clade-restricted, and this one is very nearly fixed in one of the two
  // groups.
  //
  // The whole panel is the exceptions. 1,568 of 1,575 breed dogs are homozygous
  // for it and 50 of 55 wolves are homozygous reference, so a figure that only
  // showed the rule would be one blue block over one grey block and could have
  // been a sentence. What earns the rows is that both groups leak: three of the
  // six Iranian wolves carry it, and two of the three Greenland Dogs do not.
  //
  // The Arctic breeds are in the panel to STOP a reading, which is the reason
  // they are worth their rows. Two of three Greenland Dogs being homozygous
  // reference invites "the sled breeds never got the expansion", and that is
  // wrong here: the third Greenland Dog carries it, and every Alaskan Malamute
  // and every Samoyed carries it. Drawn together the three breeds say so
  // without a caption having to.
  //
  // Built by scripts/build_dog10k_amy2b_sv.sh, which prints the whole-collection
  // tally the tutorial quotes, names all eight non-carrier dogs and all five
  // carrier wolves, and breaks the wolves down by country.
  {
    mode: 'url',
    name: 'dog10k-amy2b-duplication',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // The duplication is chr6:47,375,677-47,390,529 and the amylase gene it
      // spans is chr6:47,381,289-47,388,484. The window puts ~15 kb of flank on
      // the left and ~7 kb on the right, so both breakpoints are visibly inside
      // the frame and the block is read as a bounded event rather than as a
      // lane that runs off the edge.
      loc: 'chr6:47,362,000-47,398,000',
      tracks: [
        // The RefSeq track calls the amylase gene LOC607460 (NCBI Gene 607460,
        // "pancreatic alpha-amylase", aliases AMY2A and AMY2B), so the gene row
        // does not say AMY2B and the annotation below is what supplies the
        // name. RNPC3 starts inside the window and runs 94 kb past its right
        // edge, which is why this is 100px rather than the 60 one gene needs.
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 100,
        },
        {
          trackId: 'dog10k_amy2b_svs',
          type: 'LinearMultiSampleVariantDisplay',
          // The record itself, above the 86 rows of it (review: "put the
          // regular linearvariantdisplay above the multisamplevariantdisplay so
          // users can see what type of feature everything is"). The matrix
          // paints a genotype per dog and never says WHAT is being genotyped;
          // the lane is the one feature, drawn and labelled as the duplication
          // it is, over exactly the span the columns below cover. It is a band
          // inside this display rather than the separate LinearVariantDisplay
          // track it replaced: same records, same fetch, and the mark now sits
          // in the same box as the columns it names.
          showVariantLane: true,
          // 86 rows. The VCF holds one record, so every pixel of width is the
          // one block and the height is all that has to be budgeted.
          height: 900,
          // Breed and country in the sidebar instead of the Dog10K ids. The
          // panel's whole content is which animals sit on the wrong side of the
          // split, and "GREE000001" and "CLUPIR000003" only say that to someone
          // holding the prefix key.
          layout: AMY2B_LAYOUT,
        },
      ],
    }),
    readyText: 'chr6',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track, then the variant track: its lane, all 86 sample rows, the
    // group swatch legend and the genotype legend under it. Both halves stay
    // the same height, since the pair is read across.
    viewportHeight: 1323,
    // The gene's name, because the RefSeq row cannot supply it, plus the caveat
    // that is the reason this locus is on the page at all: the column is
    // presence/absence, and the measurement AMY2B is known for is copies. A
    // reader who takes "1/1" for "the published high copy number" has drawn the
    // wrong conclusion from a correct figure. The pill sits left of the block
    // over lane that paints nothing, so no cell is covered.
    annotations: [
      {
        type: 'text',
        text: 'LOC607460 is AMY2B.\nPresence or absence,\nnot copy number.',
        fontSize: 22,
        maxWidth: 300,
        // `textAlign: 'end'` so the offset places the pill's RIGHT edge, which
        // is the edge the arrow below has to leave from. Left-aligned, the tail
        // would have to encode the pill's measured width, and a pill is only
        // measured in the page.
        textAlign: 'end',
        anchor: {
          track: 'dog10k_amy2b_svs',
          locus: 'chr6:47,375,677-47,390,529',
          fracY: AMY2B_CALLOUT_FRAC_Y,
          dx: -430,
          dy: 0,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dog10k_amy2b_svs',
          locus: 'chr6:47,375,677-47,390,529',
          fracY: AMY2B_CALLOUT_FRAC_Y,
          dx: -420,
          dy: 0,
        },
        anchor: {
          track: 'dog10k_amy2b_svs',
          locus: 'chr6:47,375,677-47,390,529',
          fracY: AMY2B_CALLOUT_FRAC_Y,
          dx: -40,
          dy: 0,
        },
      },
    ],
  },

  // RNASE1, the mirror of the panel above and the right half of
  // dog10k-diet-genes. Pancreatic ribonuclease, and a 223 bp SINE insertion in
  // it that 26 of the 55 wolves carry against two canids in 1,824. Same panel,
  // same order, same row height as the AMY2B part, which is the whole point of
  // pairing them: a reader compares a row against itself.
  //
  // Every wolf carrier is heterozygous, so this lane is light blue where the
  // one above is dark. That is a property of the data and not of the drawing.
  //
  // From the Zenodo Paragraph set rather than the Michigan Manta aggregate.
  // Insertions are what the Paragraph genotyping added over Manta, and this
  // record is not in the Manta set at all.
  {
    mode: 'url',
    name: 'dog10k-rnase1-insertion',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // LOC475395 is chr15:18,163,424-18,164,859 and the insertion is at
      // 18,164,072, inside it. The window is tight because the gene is 1.4 kb:
      // wider and both the gene and the insertion marker are slivers.
      loc: 'chr15:18,161,500-18,167,000',
      tracks: [
        // LOC106557526 spans the whole window and LOC475395 sits inside it, so
        // this needs two packed rows rather than the one the AMY2B part uses.
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 100,
        },
        {
          trackId: 'dog10k_rnase1_svs',
          type: 'LinearMultiSampleVariantDisplay',
          // the same lane as the AMY2B half, and the pairing is the reason it
          // earns its place twice: one record draws as a block over the span it
          // duplicates, the other as an insertion marker at a point, so the two
          // halves differ in the glyph as well as in the genotypes
          showVariantLane: true,
          height: 900,
          layout: AMY2B_LAYOUT,
        },
      ],
    }),
    readyText: 'chr15',
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 1323,
    // Same two facts as the AMY2B pill and the same height in the lane, so the
    // pair reads as one figure: what the LOC symbol is, and which way this one
    // runs. The offsets are smaller than the AMY2B part's because the anchor is
    // an insertion near the middle of a 5.5 kb window rather than a block whose
    // left breakpoint is most of the way across a 36 kb one, so -430 there and
    // -430 here are not the same distance from the sidebar.
    annotations: [
      {
        type: 'text',
        text: 'LOC475395 is RNASE1.\nHere the wolves are\nthe carriers.',
        fontSize: 22,
        maxWidth: 300,
        // Right-aligned for the same reason as the AMY2B pill: the offset has
        // to place the edge the arrow leaves from.
        textAlign: 'end',
        anchor: {
          track: 'dog10k_rnase1_svs',
          locus: 'chr15:18,164,072-18,164,074',
          fracY: 0.62,
          dx: -180,
          dy: 0,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dog10k_rnase1_svs',
          locus: 'chr15:18,164,072-18,164,074',
          fracY: 0.62,
          dx: -170,
          dy: 0,
        },
        anchor: {
          track: 'dog10k_rnase1_svs',
          locus: 'chr15:18,164,072-18,164,074',
          fracY: 0.62,
          dx: -30,
          dy: 0,
        },
      },
    ],
  },

  // The two diet genes beside each other. Neither half is on the page on its
  // own: the result is that the colors swap between them over the same 86
  // animals in the same order, and two figures a scroll apart do not show that.
  //
  // Side by side rather than stacked because the two panels are alternatives to
  // compare across, not steps to read down, and because the sample rows are the
  // axis being compared: abutted vertically the two sidebars sit 1240px apart
  // and a reader has to hold a row's place across the seam, where here the same
  // row is on the same line in both halves. `direction: 'horizontal'` also puts
  // the gutter in, so the pair does not read as one window with a seam.
  {
    mode: 'compose',
    name: 'dog10k-diet-genes',
    direction: 'horizontal',
    parts: ['dog10k-amy2b-duplication', 'dog10k-rnase1-insertion'],
  },

  // The body-size selection scan, whole genome: the top half of
  // dog10k-size-fst-scan. Hudson Fst per 200 kb window between the toy/small
  // and giant animals the IGF1 figure below already panels, computed by
  // build_dog10k_size_fst.sh off the Dog10K phased panel and loaded as a
  // GWASTrack — the score column is Fst rather than -log10(p), which is what
  // `scoreColumn`/`scoreTransform: 'none'` on GWASAdapter are for.
  //
  // No `loc`, so afterAttach's showAllRegionsInAssembly lays out all 38
  // autosomes. The assembly's chrom.sizes is local to the config, so there is no
  // remote fetch for that call to race.
  {
    mode: 'url',
    name: 'dog10k-size-fst-scan-genome',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // No `loc`, so the view lays out whole regions; `displayedRegionNames`
      // restricts it to the 38 autosomes in order. The scan is autosomal (the
      // panel BCF is AutoAndXPAR), so drawing chrX would be an empty lane.
      displayedRegionNames: Array.from({ length: 38 }, (_, i) => `chr${i + 1}`),
      tracks: [
        {
          trackId: 'dog10k_size_fst',
          type: 'LinearManhattanDisplay',
          height: FST_LANE_H,
          scatterPointSize: 4,
          ...FST_AXIS,
          ...FST_SIGNIFICANCE,
        },
      ],
    }),
    readySelector: displayPainted('manhattan-display'),
    readyTimeout: 120000,
    settleMs: 10000,
    // 460, tracking the lane's own 240 (was 600 for 380)
    viewportHeight: 460,
    // Three known body-size loci among the top windows, named. A reader cannot
    // get a gene out of a scatter point, and a Manhattan whose peaks are
    // anonymous is only a shape.
    //
    // Not "the three tallest": chr10 takes thirteen of the top fourteen windows,
    // as one broad block running from about 2 to 10 Mb, so ranking by score
    // alone names that block three times. Each label sits on the highest window
    // overlapping its gene (HMGA2 rank 1, IGF1 rank 4, IGF2BP2 rank 14), which
    // build_dog10k_size_fst.sh prints so the ranks can be re-derived.
    //
    // The locus is each gene's own coordinate resolved through the live model,
    // so a re-render cannot leave a label pointing at the wrong chromosome, and
    // the score beside it is what puts the callout at the point's own height --
    // see `fstCallout`, which took over three sets of hand-fitted `dy` numbers
    // when the lane came down to 240. The scores are the drawn points', read off
    // the previous capture at the x each locus resolves to; IGF1's 0.367 is the
    // value the zoom half's own comment already carried, which is the check.
    annotations: [
      ...fstCallout(
        'dog10k_size_fst',
        'chr10:8,600,000-8,800,000',
        'HMGA2',
        0.738,
      ),
      ...fstCallout('dog10k_size_fst', IGF1_PEAK_WINDOW, 'IGF1', 0.367),
      // chr34 sits against the right edge of the view, so this one is labelled
      // from the left; the other two have room on the right.
      ...fstCallout(
        'dog10k_size_fst',
        'chr34:18,600,000-18,800,000',
        'IGF2BP2',
        0.287,
        -1,
      ),
    ],
  },

  // The zoom half of dog10k-size-fst-scan (review: "if possible create a two
  // part figure with a zoom in also"). Two megabases of chr15 around the IGF1
  // peak, the same track and the same axis as the whole-genome half above it, so
  // the labelled point up there becomes a window with neighbours to be higher
  // than and a gene track saying what it sits on. The window the tutorial slices
  // next is inside this one, which is what makes the pair a path rather than two
  // pictures.
  //
  // `highlight` rather than a callout: it is the peak window's own coordinates
  // drawn by the view, so the marked band cannot drift off the point it marks,
  // and it is in the figure's live link.
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
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
          displayMode: 'compact',
          height: 90,
        },
        {
          // THE 20 KB REBIN, not the 200 kb track the half above draws
          // (review: "is there more fine-grained fst? dog10k-igf1-haplotype
          // shows fine-grained fst"). At 200 kb this view held ten points, so
          // the zoom changed the window without changing the resolution and the
          // peak stayed a single bar. Same panel and same Hudson estimator,
          // rebinned by build_dog10k_size_fst.sh over this window alone
          // (WINDOW=20000 REGIONS=chr15:40600000-42600000), which is what makes
          // the two halves one scan at two scales rather than two datasets.
          //
          // 20 kb rather than 10: the genome-wide bin averages ~1056 informative
          // sites per 200 kb but this window runs leaner (~425 across
          // 41.4-41.6 Mb), so a 10 kb bin puts the peak windows on 20-26 sites,
          // right at the MIN_SITES=20 floor the estimator drops below, and 24 of
          // 200 windows fall out entirely. At 20 kb the peak carries 34-49 sites
          // and 99 of 100 windows score, for the same peak height (0.587 vs
          // 0.576) and the same shape.
          //
          // What the rebin buys is the shape: the 200 kb lane states one window
          // at 0.367, and this one resolves a contiguous block from 41.44 to
          // 41.58 Mb rising to 0.587 at 41.50-41.52 Mb, sitting on IGF1
          // (41,495,479-41,567,874) with flanks at ~0.1. That block is also the
          // 140 kb core dog10k-igf1-haplotype declares as its `clusterRegion`,
          // arrived at from the genotype matrix rather than from Fst.
          trackId: 'dog10k_size_fst_igf1_20kb',
          type: 'LinearManhattanDisplay',
          height: FST_LANE_H,
          // a hundred windows across this view rather than the ten the 200 kb
          // lane drew, so the points come down from 9: at that size a hundred of
          // them merge into a band and the sweep stops having edges
          scatterPointSize: 6,
          ...FST_AXIS,
        },
      ],
    }),
    readySelector: displayPainted('manhattan-display'),
    readyTimeout: 120000,
    settleMs: 6000,
    // the gene lane, all 240 px of the score lane, and its bottom border: at 700
    // the lowest windows sat on the frame edge, and 716 was that fixed against a
    // 380 lane
    viewportHeight: 576,
    // THE NAME, NOT A NUMBER (review: "the '1' is unneeded"). The pair used to
    // carry a numbered badge each, and a number is a sequence marker on a figure
    // with one zoom in it — there is nothing to be second. What the panels
    // actually share is a name, so this one says it on the band and the panel
    // above already says it at the point.
    //
    // On the highlighted window rather than beside it, so it names the peak and
    // not the frame.
    annotations: [
      {
        type: 'text',
        text: 'IGF1',
        fontSize: 20,
        anchor: {
          track: 'dog10k_size_fst_igf1_20kb',
          locus: IGF1_PEAK_WINDOW,
          fracY: 0,
          dy: 30,
        },
      },
    ],
  },

  // THE ZOOM, DRAWN (review: "dont need the numbered badge, use the trapezoid
  // like zoom system to show the connection between the two panels"). The badge
  // pair it replaces is gone from both halves; a wedge says the same thing
  // without either panel having to carry a mark that means nothing on its own.
  //
  // A gutter is what the wedge needs to exist in: stacked flush, the two parts'
  // facing edges are the same line and it has no height. 120 in the
  // composition's own px, which is 60 css px of either capture — less than the
  // 280 the two score lanes gave back, so the figure is shorter than it was.
  //
  // THE NARROW END IS SOLVED FOR, not assumed. The bottom panel is 2 Mb of
  // chr15 and the row above lays out 2,229 Mb, so the apex is under three
  // pixels wide and its position is the whole of its accuracy: 0.5% off would
  // put it on a different chromosome. The genomic fraction is not the image
  // fraction either, since the app's own margins are whatever they are, so L and
  // W come out of a least-squares fit over the row's OWN region dividers —
  // thirty-three of them found dark through the score band, every one predicted
  // to within 2.4 px:
  //
  //   x = L + f * W  ->  L = 12.5, W = 2975.8  (3000 px wide)
  //
  // which is the same data area popgen/in2lt_inversion solved for independently
  // (12.3 / 2976.0), so a third figure agreeing is the check that it is the
  // app's layout rather than one capture's accident. Re-derive by taking the
  // columns dark across the score band and fitting them against the cumulative
  // shares in UU_Cfam_GSD_1.0.chrom.sizes.
  //
  // No sideMargin, unlike that figure: chr15 sits mid-row, so neither slanted
  // side reaches an image edge.
  //
  // No label on it either. A wedge from a point to a panel is the idiom for
  // "this is that, opened up", and both panels already say IGF1.
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

  // The FGF4 retrogene (Parker et al. 2009). A processed retrocopy has no
  // introns, so reads from it pile onto the parent gene's exons and stop at each
  // splice site; a short-read SV caller reading that pileup calls a deletion of
  // each intron. The Dog10K Manta callset carries exactly two such records over
  // FGF4, and build_dog10k_fgf4_retrogene.sh asserts each one's span against the
  // RefSeq intron it claims before writing anything.
  //
  // ONE FIGURE FOR THE PAGE, not two. There was a plain LGV figure of the gene
  // model over the 55 sample rows directly above this one; once this spec took
  // the same lane at the same window (per review), that figure was a strict
  // subset of this one's middle panel and was retired
  // (review: "largely duplicates dog10k-fgf4-retrogene-synteny now").
  //
  // POSITIONAL, not the matrix display, and that is the figure rather than a
  // preference: the claim is that the two blue blocks land in the two gaps of
  // the gene model above them. A matrix spaces one column per record and throws
  // that geometry away.
  //
  // No `layout` array. The row labels and the swatch groups come from
  // `samplesTsvLocation` on the adapter (`dog10k_fgf4_samples.tsv`, written by
  // the build script off the Dog10K sample table), so the sample-to-breed
  // mapping lives beside the data instead of being restated here. The TSV's own
  // order is the row order.
  //
  // The swatch says what a breed *looks like*, never what it carries: the two
  // spaniel groups are standard-proportioned and carry a retrocopy anyway, which
  // is the second insertion (Brown et al. 2017, disc disease rather than short
  // legs). One record cannot tell the two apart, and a swatch keyed on the
  // genotype would have hidden that.
  //
  // The callset is a caller's response to a retrocopy, never the retrocopy, and
  // the ribbons are what close that gap. Both dog FGF4 retrocopies were
  // Sanger-sequenced and deposited (MF040222, the CFA18 insertion of Parker et
  // al. 2009; MF040221, the CFA12 insertion of Brown et al. 2017), so each one
  // can be aligned back to the parent gene, and build_dog10k_fgf4_synteny.sh
  // asserts that its gaps against the reference are the annotated introns before
  // writing a PAF.
  //
  // THREE LEVELS, parent gene in the middle. Both retrocopies align to the same
  // three exons, so as two regions of one row their ribbons would cross through
  // each other; on either side of the parent they instead close on it from above
  // and below, and the two deletion wedges land at the same coordinates twice.
  // The retrocopy rows are the whole contig, which is the point -- a retrocopy is
  // continuous sequence exactly where the reference has an intron.
  {
    mode: 'url',
    name: 'dog10k-fgf4-retrogene-synteny',
    // 3.8 kb, zoomed out per review from the 2.2 kb this used to draw, and the
    // right edge is not a round number: 48,872,890 is where the CFA18 alignment
    // ends, so the window holds that retrocopy end to end and the CFA12 ribbon
    // visibly runs on past it, which is the 3' difference between the two
    // records. Still not the 5 kb of the figure above, which put the whole
    // payload -- three exons, two gaps, two records -- in the left quarter of the
    // frame and gave the other three quarters to the flat 3' exon (measured: the
    // gaps plus exon 2 were 695 px of a 2,918 px data area).
    //
    // The retrocopy rows are the sub-range that covers this window, derived by
    // walking each PAF's CIGAR rather than scaled by eye. They have to be: a
    // retrocopy is 1,066 bp shorter than the reference span it covers, so a row
    // showing more would trail ribbon-free sequence and one showing less would cut
    // its own alignment.
    url: fgf4SyntenySession('chr18:48,869,100-48,872,900', {
      'FGF4retro-CFA18': 'FGF4retro-CFA18:1-2625',
      'FGF4retro-CFA12': 'FGF4retro-CFA12:2-2639',
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    settleMs: 6000,
    // an annotation lane per retrocopy, the gene lane and the 55-row sample block
    // between them, and the two synteny bands. Sized by the generator's
    // below-the-fold check, which still reported 10.5 css px under the fold at
    // 1410 -- the bottom retrocopy lane's own border. 1510 until the variant
    // lane replaced the separate one-row track, which the same check then
    // reported as 62 css px of blank; 1448 until the sample block came down to
    // its label floor, which is the 320 px between that and this.
    viewportHeight: 1128,
    // THREE LABELS, ONE PER ROW (review: "too much prose stiill. just put
    // labels 'regular gene' and 'retrogene - no introns' on different gene
    // areas of figure ... bottom row needs to also say retrogene, no introns,
    // and explain somehow that these are two diff samples").
    //
    // Each sits on its own row's gene lane, so the label is the thing it names
    // rather than a sentence about the frame, and the reader gets the finding
    // by comparing three glyphs: one gene drawn as three boxes with introns
    // between them, and two drawn as one box each.
    //
    // TWO DIFFERENT INSERTIONS, not one retrocopy drawn twice, and the labels
    // carry it: CFA18 and CFA12 are independent FGF4 retrocopies from different
    // studies (MF040222, Parker 2009; MF040221, Brown 2017), deposited
    // separately and aligned to the parent separately. The view headers name
    // the accessions; the pills name the chromosome each landed on, which is
    // the part a reader needs to see the rows are not duplicates.
    //
    // What came off the image with the old pill -- that a ribbon gap IS a
    // parent intron, and that the blue calls sit in the same two places -- is
    // in the caption and in the prose above the figure. The picture now says it
    // without being told: the gaps and the blue blocks line up on the page.
    annotations: [
      {
        type: 'text' as const,
        fontSize: 18,
        maxWidth: 320,
        text: 'retrogene - no introns (CFA18)',
        anchor: {
          view: [0, 0],
          track: 'dog10k_fgf4_retro_cfa18_genes',
          locus: 'FGF4retro-CFA18:1',
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
          track: 'canFam4_ncbi_refseq',
          locus: 'chr18:48,869,100',
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
          track: 'dog10k_fgf4_retro_cfa12_genes',
          locus: 'FGF4retro-CFA12:2',
          fracY: 1,
          dx: 14,
          dy: -26,
        },
      },
    ],
  },

  // There is deliberately NO whole-collection figure beside the panel above,
  // though `dog10k_fgf4_cohort_svs` is in the config so a reader can add the
  // lane. 1,879 rows in 520 px is a third of a pixel each: rows alias, so the
  // apparent stripe density is not the real carrier rate (the same trap the TCGA
  // cohort lane documents), and the result it was drawn for — no wolf carries
  // the record — is a 55-row band that reads as more of the surrounding
  // whitespace. The wolves are already in the panel figure as twelve labelled
  // rows, and the collection-wide count is printed by the build script, which is
  // a number the tutorial can quote and a reader can re-derive. Neither needs an
  // unreadable lane.

  // The CYP1A2 nonsense variant (Meadows et al. 2023, Fig 10): chr30:38,261,635
  // C>T turns codon 373's CGA into TGA, truncating a drug-metabolizing P450.
  // Position derived by translating the reference CDS rather than looked up, so
  // it can be re-checked. Carried by many breeds, homozygous in several, and
  // absent from all 63 wolves and 4 coyotes in the collection — the four wolf
  // rows here stand in for that. Built by scripts/build_dog10k_cyp1a2.sh.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-nonsense',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // base-level around the stop codon: a SNV is one base wide however far
      // you zoom out, so this is the only scale at which a per-sample call
      // reads as a block rather than a tick
      loc: 'chr30:38,261,590-38,261,690',
      // Which of the three forward frames is the coding one, answered by
      // color correspondence rather than by a label (review: "consider turning
      // on colorByCDS"). It does NOT single out a frame -- what it does is swap
      // the translation rows from `palette.frames` to `palette.framesCDS`
      // (sequenceGeometry.ts), which is the same bright per-frame palette a
      // gene track paints its CDS with. So the third row comes out the gene
      // track's own pink, and reads R P Q L P L M E A F I L E I F R H T S F,
      // the residues the lane below labels R358..F377. Two rows of the same
      // color carrying the same residues is what picks the frame; grey rows
      // (the default) leave the reader counting phase.
      //
      // It is a VIEW prop, not a display one: it sits beside `loc`, not in the
      // sequence track's entry.
      colorByCDS: true,
      // No view highlight on the codon, deliberately. It tints every track it
      // crosses, and over the genotype lane that washes the het/hom blues into
      // teal and olive -- the one column the figure is about stops matching the
      // legend beside it. The anchored arrow below marks the codon instead, off
      // the same coordinate, so nothing drifts and the colors stay true.
      tracks: [
        // CYP1A2 is on the + strand, so codon 373 reads directly off the
        // forward sequence: the translation row is what makes CGA -> TGA a
        // visible fact rather than a claim in the caption. Reverse strand off,
        // it says nothing here and costs a row.
        {
          trackId: 'UU_Cfam_GSD_1.0-ReferenceSequenceTrack',
          type: 'LinearReferenceSequenceDisplay',
          showForward: true,
          showReverse: false,
          showTranslation: true,
          height: 80,
        },
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 60,
        },
        {
          trackId: 'dog10k_cyp1a2_snvs',
          type: 'LinearMultiSampleVariantDisplay',
          // the same site as a plain variant lane, carrying the description a
          // reader gets from any other variant track ("C -> T"). One track now
          // rather than two: the lane reads the same filtered records the
          // columns do, so the two cannot disagree about which site is being
          // described the way two separately-filtered tracks could.
          showVariantLane: true,
          height: 500,
          layout: CYP_LAYOUT,
          // Only the stop-gained site. Two neighbours are in frame otherwise --
          // 38,261,636 (the same codon's second base) and 38,261,650, which a
          // wolf carries -- and with three anonymous columns the wolf row reads
          // as a counterexample to the very claim the figure makes. `start` is
          // POS-1.
          jexlFilters: ["jexl:get(feature,'start') == 38261634"],
        },
      ],
    }),
    readyText: 'chr30',
    readyTimeout: 90000,
    settleMs: 6000,
    // sequence + gene track plus all 39 sample rows and the genotype legend.
    // 870 (pre-sequence-track) cut the last wolf row's block against the frame.
    // The variant lane is a band inside the matrix rather than the separate 60px
    // track it replaced, so the stack lost that track's height and the rows
    // divide what is left — the run has room to spare here rather than the 13.5
    // css px it used to report.
    viewportHeight: 1024,
    // The sequence track puts CGA and its Arg on screen; `colorByCDS` above is
    // what says which of the three forward frames it is read in (the third,
    // codons beginning at positions == 1 mod 3 here from the exon's phase-2
    // start at 38,261,549; the other two carry an unrelated red stop 30 bp left
    // of the site). The label still names the consequence, because matching
    // colors show WHERE to read and not WHAT the substitution does.
    //
    // Second line is the phenotype, and it says *homozygotes* because that is
    // what the pharmacology shows: liver microsomes from T/T dogs carry no
    // CYP1A2 protein while C/T and C/C do, and every poor metabolizer typed in
    // Mise et al. 2004 / Tenmizu et al. 2004 was T/T. So the dark cells are the
    // affected animals and the light ones are carriers — a distinction the
    // legend can state but not interpret.
    annotations: [
      {
        type: 'text',
        text: 'CGA → TGA (Arg373 → stop)\nhomozygotes make no CYP1A2:\npoor drug metabolizers',
        fontSize: 22,
        anchor: {
          track: 'dog10k_cyp1a2_snvs',
          locus: 'chr30:38,261,637',
          fracY: 0,
          // right of the genotype column, over empty homozygous-reference grey
          dx: 24,
          dy: 26,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dog10k_cyp1a2_snvs',
          locus: 'chr30:38,261,637',
          fracY: 0,
          dx: 24,
          dy: 14,
        },
        anchor: {
          track: 'UU_Cfam_GSD_1.0-ReferenceSequenceTrack',
          locus: 'chr30:38,261,636',
          fracY: 1,
        },
      },
    ],
  },

  // No figure for the 15-CRAM read-depth painting (`dog10k_cyp1a2_cn`, still in
  // the config so a reader can add it). The CRAMs are an arbitrary fifteen dogs
  // -- whichever ones the share happens to publish -- so the picture invited
  // "why these breeds", and the cohort painting below covers the same locus over
  // every canid in the collection. The BED remains as what the cohort estimate
  // is validated against, not as something to look at.

  // Copy number over the gene (Meadows et al. 2023, Fig 10a) across the whole
  // collection. The SNV callset carries a per-sample DP at every site for all
  // 1,987 canids, and the same ratio of element depth to that dog's own flank
  // depth reproduces the CRAM answer (r = 0.92 per window, no bias). Painted as
  // BED9, each window rounded to an integer and colored by it, same as the
  // wolfdog ancestry figure above. A wiggle per dog was the alternative and it
  // renders each window's spread as wobble that reads like structure; rounding
  // states the call instead.
  //
  // The window is 5 kb of depth stepped by 1 kb, per review ("i also wish the
  // windows were smaller than 5kb"). 5 kb is what the counting noise sets, and
  // that was measured rather than kept: over the collection's own flanks, where
  // the answer is two by construction, 3.8% of 5 kb windows round off two
  // against 12.1% at 2.5 kb, 13.7% at 2 kb and 21.4% at 1 kb, so a narrower
  // window buys resolution by speckling a lane whose whole content is a flat
  // baseline. Sliding the same width instead paints the middle kilobase of each
  // window, which puts an element's edge within a kilobase of where it is
  // without touching the noise -- and it is what makes the zoomed-out frame
  // (185 kb, up from 60) readable rather than a row of 5 kb blocks.
  //
  // Clustered, not sorted on one window. Sorting answers "how is copy number
  // distributed at THIS position", which needed a position picked by hand and
  // which the 5 kb grid made arbitrary at the element's edges. Clustering groups
  // rows by their whole profile across the window, so the bands that come out
  // are extents rather than one column's values: animals carrying the same
  // element, at the same edges, land together. That only became worth doing when
  // the windows got finer -- at 5 kb steps most of the profile was the element
  // and there was nothing else to group on.
  //
  // Named animals above the collection, the paper's own pairing for the
  // neighbouring SLC28A3 expansion (Fig 11): labelled rows thick enough to read,
  // then the distribution over every sample.
  //
  // The upper lane is whole groups -- every Golden Retriever, Labrador Retriever
  // and Boxer in the collection, plus the four Greek wolves the nonsense-allele
  // figure draws -- so "every animal of this group carries it" is a claim the
  // panel can make. `rowOrder` runs the groups high to low.
  //
  // It replaced a wild-versus-domestic split (67 wild canids against 1,920 dogs,
  // equal pixel heights), which was legible and showed nothing: half the dogs
  // carry three or more copies too, so both lanes came out mostly red. The
  // structure in this data is per-breed.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-cohort-copy-number',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr30:38,210,000-38,395,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 90,
        },
        {
          // Directly above the paintings because it explains the widest hole in
          // them. Both lanes drop a window whose median across the collection is
          // not two, on the grounds that it is measuring the reference rather
          // than any dog, and a dropped window paints nothing -- so the white
          // stripe through every row at chr30:38,289,000-38,293,000 reads as a
          // rendering glitch until you can see the 1.4 kb CpG island sitting
          // under it (81% and 76% GC over its two central kilobases, which is
          // depth dropout in every canid). With the island on screen the hole is
          // legible as data. See the note beside MINUNIQUE in
          // scripts/build_dog10k_cyp1a2_cn.sh for why it is four blocks wide and
          // for the check that rules out the repeat mask.
          trackId: 'dog10k_cyp1a2_cpg',
          type: 'LinearBasicDisplay',
          // two rows: the labels collide before the islands do
          height: 62,
        },
        {
          // 21 rows over 380px, so each row is thick enough to carry its own
          // label and the element's extent in one animal is readable -- the
          // thing the collection lane below structurally cannot show.
          trackId: 'dog10k_cyp1a2_breed_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 380,
        },
        {
          trackId: 'dog10k_cyp1a2_cohort_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 300,
          // One-shot declarative trigger, same shape as the QTL painting's sort:
          // the display runs MultiRowClusterFeatures over the loaded features
          // and reorders its rows from the result, then clears the flag.
          runClustering: true,
          // NO breed swatch stripe, and this is a measurement rather than a
          // preference. Review asked for one ("if it helps, add breed label
          // sidebar colors too"), and a previous pass deferred it on the belief
          // that a sub-pixel row could not carry a mark. That belief is now
          // wrong -- SvgRowLabels floors its swatch to a whole pixel and
          // `rowGroups` (LinearMultiRowFeatureDisplay/configSchema) is the slot
          // for exactly this -- so it was built and measured here: the four
          // groups the panel above names (CLUP wolves, GOLD, LABR, BOXR) are
          // ~250 of 1,987 rows, which is 10 CSS px of a 300px lane, and
          // `rowGroups` also pulls them out of the copy-number sort into blocks
          // at the top of the lane. 10px of stripe cannot attribute a copy
          // number to a breed, and it costs the sorted banding that is what this
          // lane is for. The breed attribution is the named-animals lane above,
          // which is the same four groups at a readable row height.
        },
      ],
    }),
    readyText: 'chr30',
    // the dendrogram exists only once the clustering RPC has returned, which is
    // the last thing to land: waiting on the row labels instead caught the frame
    // with "Computing distance matrix 0%" still in the corner and the rows in
    // file order
    readySelector:
      'body:has([data-testid="tree_sidebar_dendrogram"]) [data-testid="multirow-row-labels"]',
    readyTimeout: 180000,
    settleMs: 8000,
    // gene track, the CpG lane, the 380px panel and the 300px collection lane,
    // their headers, and the copy-number key
    viewportHeight: 1140,
  },

  // The IGF1 body-size haplotype, drawn as a clustered genotype matrix over 167
  // canids: every animal of fourteen toy/small breeds, eleven giant breeds, and
  // the twelve Greek gray wolves. Built by scripts/build_dog10k_igf1.sh.
  //
  // THE MATRIX DISPLAY, per review ("consider using the 'matrix' mode for this.
  // hard to see the overarching pattern from snps"). In position space the
  // records sit where they are, which over 400 kb means most of the panel is the
  // gaps between them and the shared haplotype reads as speckle rather than as a
  // block. One column per record instead gives every SNV the same width, so a
  // set of animals carrying the same alleles is a solid band. The cost is that a
  // boundary now lands at a column rather than at a coordinate, which is what
  // the connector band above the rows is for. Only a little above its 20px
  // default: with hundreds of records no single line can be followed, and a tall
  // band is just a grey wedge over the rows the figure is about.
  //
  // 320 kb, which is the third window this figure has had, so here is the whole
  // sweep rather than only the answer. The separating sites (alt AF 0.82 in
  // toy/small against 0.21 in giant, 95 of 606) span 41,455,350-41,611,659, a
  // range the build script prints rather than one read off a picture. IGF1
  // itself is 41,495,479-41,567,874, so the haplotype runs 40 kb past the gene
  // upstream and 44 kb past it downstream and the frame is not the gene.
  //
  // It was 400 kb, narrowed to 220 kb on review ("i cant really tell what the
  // 'story' is here"), widened to 320 kb on the next ("zoom out if it helps show
  // larger patterns"), and is now the full 410 kb the data covers on the next
  // again ("zoomout even farther"). Both directions were real while the row
  // order depended on the window:
  //
  //   - The MATRIX wanted the window tight. Equal-width columns are what make it
  //     legible and also what make a wide frame expensive, since an
  //     undifferentiated column is exactly as wide as a separating one.
  //   - The FST LANE wanted the window wide. At 220 kb the run of differentiated
  //     sites filled the frame edge to edge, so the lane could not show that it
  //     IS a run: there was no background in view to see it rise out of.
  //
  // Rendered at 220, 320 and 450 kb and measured rather than eyeballed, since
  // "the clustering fell apart" is the thing a wider window would break. Counting
  // colour blocks down the size swatch (the row order's own summary: fewer, longer
  // blocks means the clustering recovered the size classes better) gives 19
  // blocks at 220 kb, 21 at 320 kb and 18 at 450 kb, with the two longest blocks
  // covering 63%, 52% and 52% of painted rows.
  //
  // `clusterRegion` then removed the trade entirely: the row order is now
  // computed over the 140 kb core whatever is on screen, so widening the drawn
  // window cannot move a row and only dilutes columns. THIS IS THE END OF THE
  // ZOOM-OUT ROAD, and not for a taste reason: the build script's VCF and Fst
  // BED both stop at chr15:41,350,031-41,749,214, so a wider frame adds flank
  // with no sites in it. That flank would read as "no differentiation out here"
  // when it means "no data out here", which is worse than a tight window. A
  // genuinely wider figure is a rebuild of the callset, not a locstring.
  //
  // CLUSTERED ON THE CORE, DRAWN WIDE, which is the other half of the same
  // review ("not sure if it should may cluster in narrower area and then zoom
  // out"). It works and it is measurably better: clustering is region-scoped, so
  // over the whole 320 kb the estimator is fed as many undifferentiated columns
  // as separating ones. Running it over the 140 kb core instead and then
  // navigating to the published window takes the row order from 22 colour
  // blocks down the size swatch to 17, and the two longest blocks from 49% of
  // painted rows to 67% -- the same summary the window sweep above is scored
  // on, so the two are comparable.
  //
  // It is a `clusterRegion` on the display rather than a click-chain in this
  // spec. The first version drove the UI -- open at the core, cluster, type the
  // wide window into the location box -- which worked and was wrong twice: the
  // figure's live link opened the core rather than the frame a reader is
  // looking at, and the knowledge "cluster here, look there" lived in the
  // capture instead of in the session, so no shared link could carry it. The
  // property makes the whole figure declarative again, and says the same thing
  // to a user.
  //
  // `runClustering` orders the rows by genotype similarity. The size swatch
  // comes from the samples TSV and is applied afterwards, so the row order and
  // the swatch are independent.
  //
  // STAYS CLUSTERED, whatever the window. A grouped-by-size variant was
  // rendered (groupBy: 'size', window narrowed to the differentiated core) and is
  // the wrong figure twice over: the page's result is that clustering on
  // genotypes RECOVERS the size classes, which grouping by size assumes rather
  // than shows, and it is no more legible at card size, because the toy/giant
  // contrast here is a frequency shift (|Δ| alt AF ≈ 0.5 over 41.44-41.58 Mb,
  // ≈ 0.05-0.2 outside) rather than a fixed difference. The Fst scan above states
  // the result in a shape, and is what the gallery card carries.
  {
    mode: 'url',
    name: 'dog10k-igf1-haplotype',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // the callset's own extent (41,350,031-41,749,214) with a hair of margin,
      // so every site the build produced is on screen and no empty flank is
      // painted past them
      loc: 'chr15:41,348,000-41,752,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          // the same glyph mode as dog10k-size-fst-scan-igf1, which is the
          // figure directly above this one on the page and frames part of the
          // same window: a reader moving between them should not have IGF1
          // drawn two ways
          geneGlyphMode: 'longestCoding',
          height: 80,
        },
        // What the matrix below is a picture of, as a number ("hard to say this
        // is meaningful in any way ... go for it, add fst if it makes a good
        // figure", review). The genome-wide scan two figures up is binned at
        // 200 kb, which is wider than this whole window, so it cannot say
        // anything inside it; this is the same Hudson estimator between the same
        // two panels computed one site at a time, over the very VCF the matrix
        // draws. Every point is therefore one column of the matrix, and the
        // block the clustering finds is the run of sites where the two panels
        // differ rather than a pattern the eye is asked to take on trust.
        {
          trackId: 'dog10k_igf1_fst',
          type: 'LinearManhattanDisplay',
          height: 150,
          scatterPointSize: 4,
          // the same 0-0.8 axis as the genome-wide scan on the page above, so a
          // reader moving between them is reading one scale
          ...FST_AXIS,
        },
        {
          trackId: 'dog10k_igf1_haplotype',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          height: 620,
          lineZoneHeight: 34,
          runClustering: true,
          // the 140 kb differentiated core, not the 320 kb on screen: the rows
          // are ordered on the columns that separate the panels, then drawn
          // against the flank that shows where the signal stops
          clusterRegion: 'chr15:41,440,000-41,580,000',
          colorBy: 'size',
        },
      ],
    }),
    readyText: 'chr15',
    // the dendrogram only renders once the clustering RPC lands, so this waits
    // on real completion rather than on a duration guess
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 120000,
    settleMs: 5000,
    // gene track, the Fst lane, the 760px matrix, their headers and the keys
    // 620 rather than 760 on the matrix (reviewer: "you can reduce height of
    // the multi-sample variantdisplay potentially"), which is as far as this
    // one goes: 167 samples over 620px is 3.7px a row, and the TCGA round
    // measured what happens when a matrix row goes under about 2px -- a call
    // becomes a hairline and the block structure it is drawn for stops
    // reading. The block separating toy/small from giant survives the trim.
    viewportHeight: 1135,
  },
]
