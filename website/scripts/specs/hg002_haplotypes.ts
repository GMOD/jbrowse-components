import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// T2T-HG002 v1.2 ships both haplotypes as contigs of one assembly, so the
// comparison is a self-alignment over the Q100 project's own chain. The chain
// carries both directions (3,415 chains each way, none cross-chromosome), which
// lets one track serve both panels. Its largest gap is 9,983 bp: chains split
// at 10 kb, so that is the cut, not a measurement.
//
//   zcat hg002v1.2_to_other_haplotype.chain.gz | awk '$1=="chain"{...}'
const HG002_CONFIG = 'https://jbrowse.org/demos/hg002/config.json'

// The 8p23.1 inversion, the largest inverted chain in the file:
//
//   chr8_MATERNAL:7,822,846-11,688,252  (-)  <-> chr8_PATERNAL:7,774,085-11,631,556
//
// The chain's `-` strand query coordinates are reverse-complement; reading
// qStart directly lands near 135 Mb, on the wrong arm. Both panels take the
// same coordinates so the crossing reads as one, with ~2.5 Mb of collinear
// flank each side as the control.
const INVERSION_RANGE = '5,250,000-14,250,000'
const INVERSION_WINDOW_MAT = `chr8_MATERNAL:${INVERSION_RANGE}`
const INVERSION_WINDOW_PAT = `chr8_PATERNAL:${INVERSION_RANGE}`

// The genes are v1.1 coordinates on the v1.2 assembly (no v1.2 annotation
// exists); the chr8 shift here is 1-3 bp. The paternal track is the maternal
// config with PAT in the name and URL, as the page says to make it.
function pageGeneTrack(hap: 'MAT' | 'PAT') {
  const genes = pageTrack('tutorials/hg002_haplotypes.md', 'hg002_genes_mat')
  return JSON.parse(
    JSON.stringify(genes).replaceAll('MAT', hap),
  ) as typeof genes
}

function landmarkTrack(hap: 'MAT' | 'PAT') {
  return {
    ...pageGeneTrack(hap),
    trackId: `hg002_landmarks_${hap.toLowerCase()}`,
    name: `Landmark genes (${hap}), forward red / reverse blue`,
  }
}

function geneLane(hap: 'MAT' | 'PAT', extra: Record<string, unknown> = {}) {
  return {
    trackId: `hg002_genes_${hap.toLowerCase()}`,
    geneGlyphMode: 'longestCoding',
    color: STRAND_COLOR,
    showLegend: false,
    ...extra,
  }
}

// The eight longest protein-coding genes in the inverted block, by span from
// the MAT GFF; the cut sits at the ranking's own step at 70 kb. A separate
// trackId, since a view cannot hold one track twice.
const LANDMARK_GENES = [
  'MFHAS1',
  'ERI1',
  'TNKS',
  'MSRA',
  'PINX1',
  'XKR6',
  'BLK',
  'GATA4',
]

const LANDMARK_FILTER = `jexl:${LANDMARK_GENES.map(
  g => `get(feature,'gene_name')=='${g}'`,
).join('||')}`

// Strand as color: at 9 Mb across 1400 px GATA4 and BLK are 11-13 px, too
// narrow for an arrow. The same red-forward / blue-reverse scheme as the
// ribbons, and `showLegend: false` keeps keys off the ribbons.
const STRAND_COLOR = { field: 'strand' }

function landmarkLane(hap: 'MAT' | 'PAT') {
  return {
    trackId: `hg002_landmarks_${hap.toLowerCase()}`,
    geneGlyphMode: 'longestCoding',
    filter: [LANDMARK_FILTER],
    color: STRAND_COLOR,
    showLegend: false,
    height: 60,
  }
}

// No het-site figure. The 5.2 Mb frame is over the het track's feature gate; a
// window on the breakpoint has no single paternal counterpart; and the
// collinear block beside it sits in 8p23.1's defensin/FAM90A duplication, where
// Liftoff names each haplotype's copies after different hg38 paralogs.

type PanelTracks = (string | Record<string, unknown>)[]

// A panel with no tracks draws a "No tracks active" chip that outweighs the
// ribbons, so each panel carries the same SyntenyTrack on its own coordinates.
// The chain's two directions split per panel by query contig.
const CHAIN_BLOCKS = { trackId: 'hg002v1.2_mat_vs_pat', height: 40 }

function haplotypeSession(
  matLoc: string,
  patLoc: string,
  matTracks: PanelTracks = [],
  patTracks: PanelTracks = matTracks,
  // `followSynteny`, `followAnchorIndex` and `levelHeights` are view props the
  // session restores, so a follow's steady state needs no clicks.
  viewProps: Record<string, unknown> = {},
) {
  return sessionSpec(HG002_CONFIG, {
    sessionTracks: [landmarkTrack('MAT'), landmarkTrack('PAT')],
    views: [
      {
        type: 'LinearSyntenyView',
        color: { field: 'strand' },
        mark: { interpolate: 'bump' },
        tracks: [['hg002v1.2_mat_vs_pat']],
        ...viewProps,
        views: [
          { assembly: 'hg002v1.2', loc: matLoc, tracks: matTracks },
          { assembly: 'hg002v1.2', loc: patLoc, tracks: patTracks },
        ],
      },
    ],
  })
}

// Through this collinear block the paternal copy sits 143,362 bp left of the
// maternal one. The before-frame types the same numbers into both panels, so
// the paternal window lands in the gap past the block's end and its chain lane
// is empty. The follow toggle finds the counterpart.
const DRIFT_WINDOW_MAT = 'chr8_MATERNAL:7,700,000-7,770,000'
const DRIFT_WINDOW_PAT_BEFORE = 'chr8_PATERNAL:7,700,000-7,770,000'

// No gene lanes: Liftoff names each haplotype's 8p23.1 copies after different
// hg38 paralogs, so matched panels show different names.
const DRIFTED_PANELS = haplotypeSession(
  DRIFT_WINDOW_MAT,
  DRIFT_WINDOW_PAT_BEFORE,
  [CHAIN_BLOCKS],
  [CHAIN_BLOCKS],
)

// The tour's own session. A whole-genome chain fills the ribbon at any zoom, so
// the 70 kb figure frame shows nothing moving; here, 5 Mb clear of the 8p23.1
// array, Liftoff names the same genes in both panels ~241 kb apart.
const FOLLOW_SCROLL_RANGE = '13,000,000-15,000,000'
const FOLLOW_SCROLL_PANELS = haplotypeSession(
  `chr8_MATERNAL:${FOLLOW_SCROLL_RANGE}`,
  `chr8_PATERNAL:${FOLLOW_SCROLL_RANGE}`,
  [CHAIN_BLOCKS, geneLane('MAT', { height: 60 })],
  [CHAIN_BLOCKS, geneLane('PAT', { height: 60 })],
  { axis: { grid: true } },
)

// A 9,112 bp maternal-only insertion with no other gap of 50 bp or more within
// 60 kb either side. It sits right of centre, clear of the settings menu.
const MARKER_WINDOW_MAT = 'chr11_MATERNAL:24,474,000-24,534,000'
// The same 60 kb span, so both rows draw at one bp/px.
const MARKER_WINDOW_PAT = 'chr11_PATERNAL:24,486,820-24,546,820'

const CAPTURE = {
  mode: 'url',
  viewportWidth: 1400,
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
} satisfies Partial<ScreenshotSpec>

// One glob per haplotype, shared by the axes, the import-form figure and the
// tour.
const MATERNAL_GLOB = '*_MATERNAL'
const PATERNAL_GLOB = '*_PATERNAL'

// `displayedRegionNames` matches globs through selectNamedRegions.
// chrX_MATERNAL and chrY_PATERNAL have no counterpart on the other axis, so
// those lanes come out empty, as they should for a male sample.
const WHOLE_GENOME_AXES = [
  { assembly: 'hg002v1.2', displayedRegionNames: [MATERNAL_GLOB] },
  { assembly: 'hg002v1.2', displayedRegionNames: [PATERNAL_GLOB] },
]

// What videos/synteny.ts films. `views: []` opens the view launcher, so `Add ->
// Dotplot view` is in the clip.
export const hg002VideoFixtures = {
  noViews: sessionSpec(HG002_CONFIG, { views: [] }),
  followScrollPanels: FOLLOW_SCROLL_PANELS,
  maternalGlob: MATERNAL_GLOB,
  paternalGlob: PATERNAL_GLOB,
}

export const hg002HaplotypeSpecs: ScreenshotSpec[] = [
  // `views: [{}, {}]` opens the import form: launchSyntenyView throws below two
  // views, and two unnamed axes are applyInit's route to the form.
  {
    mode: 'url',
    name: 'hg002_haplotypes_import_form',
    url: sessionSpec(HG002_CONFIG, {
      views: [{ type: 'DotplotView', views: [{}, {}] }],
    }),
    readySelector: '[data-testid="import-form"]',
    readyTimeout: 120000,
    viewportWidth: 950,
    viewportHeight: 561,
    stages: [
      {
        actions: [
          // The form opens in Quick start, which has no chromosome boxes;
          // Manual and the opt-in click are both part of the reader's path.
          { type: 'click', text: 'Manual' },
          { type: 'click', text: 'Plot only certain chromosomes' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="chromosome-filter-x"]',
          },
          {
            type: 'type',
            selector: '[data-testid="chromosome-filter-x"]',
            value: MATERNAL_GLOB,
          },
          {
            type: 'type',
            selector: '[data-testid="chromosome-filter-y"]',
            value: PATERNAL_GLOB,
          },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="chromosome-filter-x"]' },
            strokeWidth: 3,
          },
          {
            type: 'box',
            anchor: { selector: '[data-testid="chromosome-filter-y"]' },
            strokeWidth: 3,
          },
        ],
      },
    ],
  },
  {
    mode: 'url',
    name: 'hg002_haplotypes_wholegenome',
    url: sessionSpec(HG002_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          displayName: 'T2T-HG002 v1.2 maternal (x) vs paternal (y)',
          // Strand color is the only signal off the diagonal: the 493 inverted
          // chains draw as blue ticks.
          color: { field: 'strand' },
          views: WHOLE_GENOME_AXES,
          tracks: ['hg002v1.2_mat_vs_pat'],
        },
        {
          type: 'DotplotView',
          displayName: 'chr8 maternal (x) vs paternal (y)',
          color: { field: 'strand' },
          views: [
            { assembly: 'hg002v1.2', displayedRegionNames: ['chr8_MATERNAL'] },
            { assembly: 'hg002v1.2', displayedRegionNames: ['chr8_PATERNAL'] },
          ],
          tracks: ['hg002v1.2_mat_vs_pat'],
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 120000,
    // The view's height is fixed, so width is the only aspect control; 1400
    // would draw the plot twice as wide as tall.
    viewportWidth: 950,
    viewportHeight: 1450,
  },
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_8p23_inversion',
    url: haplotypeSession(
      INVERSION_WINDOW_MAT,
      INVERSION_WINDOW_PAT,
      // The landmark lanes sit next to the ribbons on both sides, so the two
      // rows of names are as close as this layout allows.
      [
        CHAIN_BLOCKS,
        geneLane('MAT', { showLabels: 'none', height: 60 }),
        landmarkLane('MAT'),
      ],
      [
        landmarkLane('PAT'),
        CHAIN_BLOCKS,
        geneLane('PAT', { showLabels: 'none', height: 60 }),
      ],
    ),
    viewportHeight: 850,
  },
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_follow_panel',
    url: DRIFTED_PANELS,
    viewportHeight: 454,
    // Stacked: two 1400px frames side by side are too wide for the page.
    tooltip: 'hide',
    stages: [
      {
        actions: [{ type: 'delay', ms: 500 }],
        // Stage titles anchor inside the app bar, whose left half is empty;
        // lower, the title covers the MATERNAL search box both frames rely on.
        // At the 420 default `maxWidth` this title wraps onto the toolbar.
        annotations: [
          {
            type: 'text',
            anchor: {
              selector: '[data-testid="app-bar"]',
              alignX: 'left',
              alignY: 'top',
              dx: 24,
              dy: 30,
            },
            maxWidth: 640,
            fontSize: 22,
            // Do not phrase this as the rulers sharing coordinates; readers
            // take that as the regions matching.
            text: '(1) The two panels show non-matching sequence, so the synteny ribbons do not line up here',
          },
          {
            type: 'circle',
            anchor: { selector: '[data-testid="follow-synteny-toggle"]' },
            strokeWidth: 4,
          },
        ],
      },
      {
        actions: [
          {
            type: 'click',
            selector: '[data-testid="follow-synteny-toggle"]',
          },
        ],
        annotations: [
          {
            type: 'text',
            anchor: {
              selector: '[data-testid="app-bar"]',
              alignX: 'left',
              alignY: 'top',
              dx: 24,
              dy: 30,
            },
            maxWidth: 640,
            fontSize: 22,
            text: '(2) Follow moves the paternal panel to the matching sequence, and holds it there as you pan',
          },
          {
            type: 'circle',
            anchor: { selector: '[data-testid="follow-synteny-toggle"]' },
            strokeWidth: 4,
          },
        ],
      },
    ],
  },

  // The markers with the menu still open: a checkbox row keeps CascadingMenu
  // open after the click.
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_location_markers',
    url: haplotypeSession(
      MARKER_WINDOW_MAT,
      MARKER_WINDOW_PAT,
      [CHAIN_BLOCKS],
      [CHAIN_BLOCKS],
      { levelHeights: [190] },
    ),
    // MUI drops the ~390 px settings menu below its trigger only while it fits;
    // shorter, it shifts up over the circled button.
    viewportHeight: 560,
    tooltip: 'hide',
    actions: [
      { type: 'click', selector: '[aria-label="Synteny display settings"]' },
      { type: 'waitForText', text: 'Location markers' },
      { type: 'click', text: 'Location markers' },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[aria-label="Synteny display settings"]' },
      },
      {
        type: 'box',
        anchor: { text: 'Location markers' },
        strokeWidth: 3,
      },
      {
        type: 'text',
        text: 'maternal-only insertion',
        leader: true,
        anchor: {
          view: [0, 0],
          trackId: 'hg002v1.2_mat_vs_pat',
          loc: 'chr11_MATERNAL:24,513,461',
          fracY: 1,
        },
        dx: 180,
        dy: 120,
      },
    ],
  },
]
