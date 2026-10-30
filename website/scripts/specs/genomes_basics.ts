import {
  PARK_CURSOR,
  UCSC_HG38_CONFIG,
  cascadeBoxes,
  menuCascade,
  readIsoformNotice,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// These specs load genomes.jbrowse.org's own hg38 config, so track names and
// categories match the live site. hgdownload is slow, hence the long timeouts.
//
// A color key for the cCRE, gnomAD and phyloP tracks belongs in the jb2hubs
// output, not in a spec override.

// Ends at the collapsed TP53 transcript's drawn 5' end (7,677,451), so the
// signal has a gene under it across the whole frame.
const TP53_TRANSCRIPT_WINDOW = 'chr17:7,668,400-7,677,600'

// Exon bounds from UCSC's ncbiRefSeqCurated. At 110 bp the sequence track
// draws letters and translation rows.
const TP53_EXON_WINDOW = 'chr17:7,674,180-7,674,290'

// TP53 is on the minus strand, so its TSS sits at the right edge. The gene body
// gives the promoter marks a flat stretch to compare against.
const TP53_LOCUS_WINDOW = 'chr17:7,666,000-7,694,000'

// The RefSeq (GCF_) half carries the gene tracks and the name index that
// `loc: 'tp53'` needs; the GCA_ of the same assembly has neither.
const AXOLOTL_CONFIG =
  'https://jbrowse.org/hubs/genark/GCF/040/938/575/GCF_040938575.1/config.json'
const AXOLOTL_ASSEMBLY = 'GCF_040938575.1'

// No display settings, so the track draws as the site's defaultSession opens it.
const GENE_TRACK = { trackId: 'hg38-ncbiRefSeq' }
const PHYLOP_TRACK = { trackId: 'hg38-phyloP100way' }

// A stale trackId fails the capture; a stale track name would render empty.
const GNOMAD_TRACK_ID = 'hg38-gnomadExomesVariantsV4_1'

// The ENCODE3 seven-cell-line panel. The hub's ENCODE4 organ averages carry
// 55-64 sources, illegible both overlaid and as rows. The hub opens these as an
// `xyplot`; both frames spell `rows` so neither rests on that default.
const H3K4ME3_OVERLAY = {
  trackId: 'hg38-wgEncodeRegMarkH3k4me3',
  rows: '',
}
const H3K27AC_OVERLAY = {
  trackId: 'hg38-wgEncodeRegMarkH3k27ac',
  rows: '',
}
const H3K4ME3_ROWS = { ...H3K4ME3_OVERLAY, rows: 'source' }
const H3K27AC_ROWS = { ...H3K27AC_OVERLAY, rows: 'source' }

// Written out, not imported: check-menu-labels resolves each segment against
// the app's literals, and an import would make that check vacuous.
const PLOT_TYPE_PATH = ['Plot type', 'Multi-row', 'Bar plot']

const GNOMAD_PLOF = "feature.annot == 'pLoF'"

const FILTER_TEXT = '[data-testid="jexl-filter-text"]'

// A reader reaches this mode with one click on the gene track's isoform chip.
const GENE_TRACK_COLLAPSED = {
  ...GENE_TRACK,
  geneGlyphMode: 'representative',
}

// A bare `?config=` opens the hub's defaultSession, as a reader arriving does.
// Without `sessionName` the app bar shows the capture's wall-clock time.
const LANDING = `?config=${UCSC_HG38_CONFIG}&sessionName=Screenshot`

// Captured live: the site builds from ~/src/jb2hubs, and a stale front page is
// a regression worth catching. Its pages are plain Astro, so only `readyText`
// gates the capture.
const SITE = 'https://genomes.jbrowse.org'

// What videos/genomes_basics.ts films; each tour opens on a state a figure here
// shows.
export const genomesBasicsVideoFixtures = {
  gnomadTrackId: GNOMAD_TRACK_ID,
  plof: GNOMAD_PLOF,
  filterText: FILTER_TEXT,
  // Taller than the figure's 200: the tour ends on the app alone, and at 200 a
  // third of the closing frame is page background.
  unfilteredGnomad: sessionSpec(UCSC_HG38_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: TP53_TRANSCRIPT_WINDOW,
        tracks: [{ trackId: GNOMAD_TRACK_ID, height: 340 }],
      },
    ],
  }),
  geneTrackOnly: sessionSpec(UCSC_HG38_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: TP53_TRANSCRIPT_WINDOW,
        tracks: [GENE_TRACK_COLLAPSED],
      },
    ],
  }),
  // UCSC publishes six phyloP tracks on hg38 and the filter box matches all of
  // them; the words after the parenthesis pick this one.
  phylopTrackName:
    'Basewise Conservation (phyloP) - 100-way vertebrate alignment',
  phylopTrackId: PHYLOP_TRACK.trackId,
}

export const genomesBasicsSpecs: ScreenshotSpec[] = [
  // 1100 wide: the site's fixed column leaves a wider capture blank on the
  // right. Any height past 720 cuts a row of the species-category table.
  {
    mode: 'url',
    name: 'genomes_basics/site_home',
    noSession: true,
    url: SITE,
    readyText: 'GenArk',
    viewportWidth: 1100,
    viewportHeight: 720,
    liveLabel: 'Open genomes.jbrowse.org',
    diffThreshold: 0.02,
  },

  // The search index loads only once the box takes focus, so the wait is on an
  // option appearing.
  {
    mode: 'url',
    name: 'genomes_basics/site_search',
    noSession: true,
    url: SITE,
    readyText: 'GenArk',
    viewportWidth: 1100,
    viewportHeight: 620,
    liveLabel: 'Open genomes.jbrowse.org',
    diffThreshold: 0.02,
    actions: [
      {
        type: 'type',
        selector: '#header-search-input',
        value: 'human',
      },
      {
        type: 'waitForSelector',
        selector: '#header-search-listbox a',
        timeout: 60000,
      },
    ],
  },

  {
    mode: 'url',
    name: 'genomes_basics/site_ucsc_list',
    noSession: true,
    url: `${SITE}/ucsc`,
    readyText: 'hg38',
    viewportHeight: 1000,
    liveLabel: 'Open the UCSC genome list',
    diffThreshold: 0.02,
  },

  // Type, then Enter, then collapse: the walkthrough must not skip the collapse
  // click. The second frame declares its session because pressing Enter also
  // opens the RefSeq All (GFF) track, which the page never mentions.
  {
    mode: 'url',
    name: 'genomes_basics/search_tp53',
    url: LANDING,
    readyText: 'NCBI RefSeq',
    readyTimeout: 120000,
    viewportHeight: 440,
    diffThreshold: 0.02,
    stages: [
      {
        viewportHeight: 340,
        actions: [
          {
            type: 'type',
            selector: 'input[placeholder="Search for location"]',
            value: 'TP53',
            clear: true,
          },
          { type: 'waitForText', text: 'TP53' },
        ],
      },
      {
        // GENE_TRACK carries no settings, so this is what Enter opens
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              loc: TP53_TRANSCRIPT_WINDOW,
              tracks: [GENE_TRACK],
            },
          ],
        }),
        viewportHeight: 340,
        actions: [PARK_CURSOR],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="track-control-isoform"]' },
          },
        ],
      },
    ],
  },

  // `readIsoformNotice` dismisses the first-session chip so the figure shows the
  // quiet icon a reader meets afterwards. `auto` would show no chip at all: it
  // resolves to `all` below 100 bp/px.
  {
    mode: 'url',
    name: 'genomes_basics/isoform_control',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [GENE_TRACK_COLLAPSED],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    viewportWidth: 900,
    viewportHeight: 340,
    diffThreshold: 0.02,
    clicksOpen: "the gene track's isoform control",
    actions: [
      ...readIsoformNotice(),
      { type: 'click', selector: '[data-testid="track-control-isoform"]' },
      { type: 'waitForText', text: 'Representative transcript' },
      { type: 'delay', ms: 800 },
    ],
    // MUI opens the popover in the opposite corner, so the ring says what was
    // clicked.
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="track-control-isoform"]' },
      },
    ],
  },

  // Both tracks are 470-way because UCSC publishes no bigMaf for multiz100way.
  // LinearMafDisplay byte-gates on the bigMaf's R-tree estimate, so a gene-wide
  // window shows a force-load prompt.
  {
    mode: 'url',
    name: 'genomes_basics/multiz_alignment',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          tracks: [
            GENE_TRACK_COLLAPSED,
            { trackId: 'hg38-phyloP470wayBW' },
            { trackId: 'hg38-multiz470way' },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    viewportHeight: 825,
    diffThreshold: 0.02,
  },

  // The page steps through one locus, so the tracks below stay at TP53.

  // Frame 2 loads a session: a click changes one track, and one mark split
  // beside one still overlaid reads as a bug. EPDnew closes the stack because
  // JASPAR draws a solid field of motif matches at any width.
  {
    mode: 'url',
    name: 'genomes_basics/promoter_regulation',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_LOCUS_WINDOW,
          tracks: [
            { ...GENE_TRACK_COLLAPSED, height: 60 },
            { trackId: 'hg38-cpgIslandExt', height: 50 },
            { trackId: 'hg38-cCREregistry', height: 60 },
            { ...H3K4ME3_OVERLAY, height: 150 },
            { ...H3K27AC_OVERLAY, height: 150 },
            { trackId: 'hg38-epdNewPromoter', height: 60 },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 180000,
    viewportWidth: 1000,
    viewportHeight: 940,
    columns: 2,
    // room for the arrow; the 24px default leaves it a hairline
    gutter: 240,
    diffThreshold: 0.02,
    tooltip: 'hide',
    // `alignY: 'top'` puts the arrow on the app bars, the one empty band
    annotations: [
      {
        type: 'arrow',
        strokeWidth: 10,
        fromAnchor: {
          selector: '[data-part="0"]',
          alignX: 'right',
          alignY: 'top',
          dy: 60,
        },
        anchor: {
          selector: '[data-part="1"]',
          alignX: 'left',
          alignY: 'top',
          dy: 60,
        },
      },
    ],
    stages: [
      {
        actions: [
          trackMenuIcon(H3K4ME3_OVERLAY.trackId),
          ...menuCascade(PLOT_TYPE_PATH),
        ],
        // The menu opens over another track's rows, so the ring marks which ⋮
        // opened it.
        annotations: [
          ...cascadeBoxes(PLOT_TYPE_PATH),
          {
            type: 'circle',
            anchor: {
              selector: `[data-testid="track_menu_icon"][data-trackid="${H3K4ME3_OVERLAY.trackId}"]`,
            },
          },
        ],
      },
      {
        url: sessionSpec(UCSC_HG38_CONFIG, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              loc: TP53_LOCUS_WINDOW,
              tracks: [
                { ...GENE_TRACK_COLLAPSED, height: 60 },
                { trackId: 'hg38-cpgIslandExt', height: 50 },
                { trackId: 'hg38-cCREregistry', height: 60 },
                { ...H3K4ME3_ROWS, height: 150 },
                { ...H3K27AC_ROWS, height: 150 },
                { trackId: 'hg38-epdNewPromoter', height: 60 },
              ],
            },
          ],
        }),
        actions: [PARK_CURSOR],
      },
    ],
  },

  // The track starts unfiltered: with a filter in effect, `filterMenuItems`
  // turns the row into a "Filter by (1)" submenu, a different click path.
  {
    mode: 'url',
    name: 'genomes_basics/gnomad_filter_menu',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          tracks: [{ trackId: GNOMAD_TRACK_ID, height: 200 }],
        },
      ],
    }),
    readyText: 'gnomAD',
    readyTimeout: 180000,
    viewportHeight: 590,
    diffThreshold: 0.02,
    // clicking leaves the track's hover tooltip over the menu
    tooltip: 'hide',
    stages: [
      {
        actions: [
          trackMenuIcon(GNOMAD_TRACK_ID),
          { type: 'waitForText', text: 'Filter by' },
        ],
        annotations: cascadeBoxes(['Filter by']),
        viewportHeight: 560,
      },
      {
        actions: [
          { type: 'click', text: 'Filter by' },
          { type: 'click', text: 'Edit filters...' },
          { type: 'waitForSelector', selector: FILTER_TEXT },
          { type: 'type', selector: FILTER_TEXT, value: GNOMAD_PLOF },
          { type: 'delay', ms: 500 },
        ],
        // without this, the first frame's 560 carries over and clips the dialog
        viewportHeight: 590,
      },
    ],
  },

  {
    mode: 'url',
    name: 'genomes_basics/about_track',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          // at default height the menu panel sits two-thirds empty beside the
          // dialog's panel
          tracks: [{ ...PHYLOP_TRACK, height: 400 }],
        },
      ],
    }),
    readyText: 'phyloP',
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 700,
    columns: 2,
    diffThreshold: 0.02,
    stages: [
      {
        actions: [
          trackMenuIcon('hg38-phyloP100way'),
          { type: 'waitForText', text: 'About track' },
          { type: 'delay', ms: 800 },
        ],
        // The menu opens where it fits, so the ring marks the kebab that opened
        // it.
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector:
                '[data-testid="track_menu_icon"][data-trackid="hg38-phyloP100way"]',
            },
          },
          ...cascadeBoxes(['About track']),
        ],
      },
      {
        actions: [
          { type: 'click', text: 'About track' },
          { type: 'waitForText', text: 'bigWigLocation' },
        ],
      },
    ],
  },

  // `loc` is the bare symbol, so the frame proves the accession's name index
  // answers it, and the search opens RefSeq All (GFF) itself.
  //
  // Add no tracks: GC Percent and RepeatMasker each need a display setting that
  // no click on the live site reaches. A repeat lane returns once jb2hubs opens
  // its RMSK_MULTIROW_DISPLAY gate for GenArk.
  {
    mode: 'url',
    name: 'genomes_basics/genark_axolotl',
    url: sessionSpec(AXOLOTL_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: AXOLOTL_ASSEMBLY,
          loc: 'tp53',
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 180000,
    viewportHeight: 335,
    diffThreshold: 0.02,
  },
]
