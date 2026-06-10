export interface ScreenshotAction {
  type:
    | 'click'
    | 'rightclick'
    | 'hover'
    | 'type'
    | 'drag'
    | 'waitForText'
    | 'waitForSelector'
    | 'delay'
  selector?: string
  text?: string
  ms?: number
  // for 'waitForText'/'waitForSelector': wait for the element to be hidden
  hidden?: boolean
  // for 'type': text to type into the focused/selected input
  value?: string
  // for 'type': triple-click the field to select existing content first
  clear?: boolean
  // for 'drag': start/end points in viewport CSS px (used for rubberband drags)
  from?: { x: number; y: number }
  to?: { x: number; y: number }
}

// A callout drawn over the captured page (SVG overlay) before the screenshot,
// to reproduce the red arrows / boxes / text labels that hand-made teaching
// figures use. Coordinates are viewport CSS px.
//
// Instead of hand-tuning pixel coordinates, an annotation can `anchor` to a live
// DOM element (by CSS selector or visible text): its position (and a box/ring's
// size) is then computed from that element's bounding box at capture time, so
// the callout tracks the real UI. `dx`/`dy` nudge the anchored position.
export interface Annotation {
  // arrow: tail -> head; box/highlight: x/y/width/height (ring around a region);
  // text: x/y baseline; circle: filled numbered badge (with text) or an outline
  // ring around the anchored element (without text)
  type: 'arrow' | 'box' | 'text' | 'circle'
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number // circle radius (default 16, or derived from anchored element)
  text?: string
  color?: string // default red (#e3242b)
  textColor?: string // circle/text label color (circle default white)
  fontSize?: number // text/circle label, default 18
  anchor?: { selector?: string; text?: string }
  dx?: number
  dy?: number
}

// One frame of a multi-stage figure. The page is captured after this stage's
// actions run; the frames are stacked vertically (ImageMagick `-append`) into a
// single image, replacing the hand-run `convert -append` teaching figures.
export interface ScreenshotStage {
  actions?: ScreenshotAction[]
  annotations?: Annotation[]
  // press Escape before this stage's actions to dismiss a menu/popover the
  // previous stage left open
  closeMenusFirst?: boolean
}

interface CommonSpecFields {
  // committed PNG is a hand-curated / real-human-data screenshot the spec body
  // can't reproduce; the generator skips it so a regen never clobbers it
  curated?: boolean
  // capture-viewport height in CSS px for this spec (default 800); raise it for
  // tall multi-row pileups so the track isn't clipped by the default viewport
  viewportHeight?: number
  // capture-viewport width in CSS px for this spec (default 1500); raise it for
  // wide multi-panel layouts (dotplot/synteny/whole-genome) that get cut off
  viewportWidth?: number
  // callouts drawn over the page before capture (arrows/boxes/text/circles)
  annotations?: Annotation[]
  // multi-stage figure: each stage is captured and the frames stacked vertically
  stages?: ScreenshotStage[]
  // suppress the hover/right-click BaseTooltip (which lingers while a context
  // menu is open) so it doesn't clutter the capture
  hideTooltip?: boolean
}

// Mode 1: navigate to app, interact via UI to open tracks.
// This is the reliable approach — plugins are fully loaded before tracks open.
interface LGVSpec extends CommonSpecFields {
  mode?: 'lgv'
  name: string
  config?: string // defaults to volvox config
  loc?: string // location to navigate to (default: config default)
  openTracks?: string[] // track IDs to click open in the track selector
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

// Mode 2: navigate directly to a session spec URL.
// Use for multi-view layouts (dotplot, synteny) where the UI approach is awkward.
interface SessionUrlSpec extends CommonSpecFields {
  mode: 'url'
  name: string
  url: string // full query string starting with '?' or a full URL
  readyText?: string // text to wait for before settle
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
  waitUntil?: 'networkidle0' | 'domcontentloaded' // override goto waitUntil
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

export type ScreenshotSpec = LGVSpec | SessionUrlSpec

const VOLVOX = 'test_data/volvox/config.json'
// volvox_sv_cram's adapter, reused to build the two strand-split session tracks
// that the group-by spec renders. Session tracks don't inherit the config's
// baseUri, so an absolute url is used (the same volvox test data jbrowse.org
// hosts) — works in both the local generator and the live-link instance.
const VOLVOX_SV_CRAM = 'https://jbrowse.org/code/jb2/latest/test_data/volvox'
const VOLVOX_SV_CRAM_ADAPTER = {
  type: 'CramAdapter',
  cramLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram`,
    locationType: 'UriLocation',
  },
  craiLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram.crai`,
    locationType: 'UriLocation',
  },
}
const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
const SYNTENY_CONFIG = 'test_data/grape_peach_synteny/config.json'
const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
const DEMO_CONFIG = 'test_data/config_demo.json'
const CGIAB_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json'
const HPYLORI_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/hpylori/config.json'

function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

function cgiabUrl(session?: object) {
  if (!session) {
    return CGIAB_BASE
  }
  return `${CGIAB_BASE}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

function hpyloriUrl(session: object) {
  return `${HPYLORI_BASE}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

// remote 1000-genomes config loaded against the *local* build (a bare ?config=
// url), so new display settings like readConnections render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns
// this into a jbrowse.org link for readers.
const KG_CONFIG =
  'https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json'

function kgUrl(session: object) {
  return `?config=${encodeURIComponent(KG_CONFIG)}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

// Three H. pylori strains stacked top-to-bottom, with a synteny track between
// each adjacent pair and a gene annotation track on each genome, used by the
// synteny_visualization.md tutorial.
function hpyloriSyntenyWithGenes() {
  return hpyloriUrl({
    views: [
      {
        type: 'LinearSyntenyView',
        tracks: ['26695_vs_chc155.pif', 'chc155_vs_j99.pif'],
        views: [
          {
            loc: 'NC_018939.1:177696-190329',
            assembly: 'hpylori_26695',
            tracks: ['hpylori_26695.gff'],
          },
          {
            loc: 'NZ_AP026446.1:287157-299790',
            assembly: 'hpylori_chc155',
            tracks: ['hpylori_chc155.gff'],
          },
          {
            loc: 'NZ_CP011330.1:872350-884982',
            assembly: 'hpylori_j99',
            tracks: ['hpylori_j99.gff'],
          },
        ],
      },
    ],
  })
}

export const specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_alignments',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_cram_alignments'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'volvox_variants',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:5000-10000',
          tracks: ['volvox_test_vcf'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'variant_with_pileup',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1500-3500',
          tracks: ['volvox_filtered_vcf', 'volvox_cram_alignments'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  // Multi-sample variant display colored by population: the 1000 Genomes phase 3
  // chr1 callset (2,504 samples) with a population samples-TSV, so the per-sample
  // rows group/color by the 26 population codes. The track config in
  // config_demo.json sets colorBy: 'population' on its LinearMultiSampleVariantDisplay.
  // Remote NCBI VCF — give it a long ready timeout and settle.
  {
    mode: 'url',
    name: 'variants/population_1000genomes',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:1,000,000-1,020,000',
          tracks: [
            {
              trackId:
                '1kGP_high_coverage_Illumina.chr1.filtered.SNV_INDEL_SV_phased_panel.vcf',
              displaySnapshot: {
                type: 'LinearMultiSampleVariantDisplay',
                height: 500,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    settleMs: 18000,
    viewportHeight: 650,
  },

  {
    mode: 'url',
    name: 'bigwig_xyplot',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_microarray'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'bigwig_line',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_microarray_line'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'bigwig/whole_genome_coverage',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-NTYME90lkA&password=G6Hkw',
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'sequence_track',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:20000-20050',
          tracks: ['volvox_refseq'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'alignments_soft_clipped',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:2615-2725',
          tracks: [
            {
              trackId: 'volvox-long-reads-sv-bam',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                showSoftClipping: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  // Realistic arc display: SKBR3 breast-cancer cell line at a chr1→chr14
  // translocation breakpoint (sniffles call 596_2, ~chr1:9,121,448). The PacBio
  // sniffles SV calls sit on top; the Illumina paired-end reads below, drawn with
  // readConnections:'arc', arc to their mates — concordant pairs make small grey
  // arcs while the discordant pairs spanning the translocation draw the prominent
  // red arcs that make the figure meaningful. (The reviewer's suggested chr1:72Mb
  // locus only carries small indels, so this nearby real translocation is used
  // instead.) Window kept under AUTO_FORCE_LOAD_BP (20kb) so the high-coverage
  // CRAM loads without a force-load click. Remote DEMO_CONFIG data, slow to load.
  {
    mode: 'url',
    name: 'alignments/arc_display',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:9,113,000-9,130,000',
          tracks: [
            'breast_cancer_sniffles_hg19',
            {
              trackId:
                'SKBR3_550bp_pcrFREE_S1_L001_AND_L002_R1_001.101bp.bwamem.ill.mapped.sort.cram',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                readConnections: 'arc',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Read cloud (samplot-style) display on the volvox synthetic-SV CRAM: mates are
  // laid out on the Y axis by the log distance between them, so insertion pairs
  // (drawn pink) separate from background. Drawn below the coverage band
  // (readConnectionsDown) so the cloud doesn't overlap the coverage histogram.
  // Paired arcs have their own spec above (arc_display).
  {
    mode: 'url',
    name: 'alignments/read_cloud',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_sv_cram_linked',
          name: 'volvox-sv read cloud',
          assemblyNames: ['volvox'],
          adapter: VOLVOX_SV_CRAM_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram_linked',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                readConnections: 'samplot',
                readConnectionsDown: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 800,
    settleMs: 6000,
  },

  // The top-level "Add" menu (Circular / Dotplot / Linear genome / Linear
  // synteny / Tabular data / SV inspector), cropped to the menu for the
  // developer "menus" guide. Replaces a stale capture where Add was nested
  // under File.
  {
    mode: 'url',
    name: 'top_level_menus',
    url: `?config=${VOLVOX}&sessionName=Screenshot`,
    readyText: 'ctgA',
    settleMs: 2500,
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Linear genome view' },
      { type: 'delay', ms: 500 },
    ],
  },

  // About track dialog (config + file header), opened from the track menu of a
  // CRAM track so the FILE INFO panel shows the full @SQ/@PG header.
  {
    mode: 'url',
    name: 'about_track',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_cram'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'About track' },
      { type: 'waitForText', text: 'AlignmentsTrack' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Location-search autocomplete: typing a gene name into the search box surfaces
  // matching features from the assembly's text-search index.
  {
    mode: 'url',
    name: 'searching_lgv',
    url: `?config=${VOLVOX}&sessionName=Screenshot`,
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'eden',
        clear: true,
      },
      { type: 'waitForText', text: 'EDEN.1' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Rubberband selection on the main scalebar, which pops the "Zoom to region /
  // Get sequence / Copy range / Bookmark region" menu.
  {
    mode: 'url',
    name: 'rubberband',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_cram'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Zoom to region' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // The LGV view (hamburger) menu open, showing the "Show center line" toggle.
  {
    mode: 'url',
    name: 'alignments_center_line_menu',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:2615-2725',
          tracks: ['volvox-long-reads-sv-cram'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'hover', text: 'Show...' },
      { type: 'waitForText', text: 'Show center line' },
      { type: 'delay', ms: 300 },
      // keep the mouse on the submenu item so it stays open at capture time
      { type: 'hover', text: 'Show center line' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Show center line' } }],
  },

  // Track menu -> "Show..." submenu exposing the "Show soft clipping" toggle.
  {
    mode: 'url',
    name: 'alignments_soft_clipped_menu',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:2615-2725',
          tracks: ['volvox-long-reads-sv-cram'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'hover', text: 'Show...' },
      { type: 'waitForText', text: 'Show soft clipping' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Show soft clipping' } }],
  },

  // Right-click context menu on a read in a LinearAlignmentsDisplay (Open
  // feature details / Copy info / Dotplot of read vs ref / Linear read vs ref).
  // Read glyphs are canvas-drawn, so the rightclick uses a viewport coordinate;
  // a follow-up mouse move off the read clears its hover tooltip.
  {
    mode: 'url',
    name: 'linear_align_ctx_menu',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1500-2000',
          tracks: ['volvox-long-reads-sv-cram'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 6000,
    hideTooltip: true,
    actions: [
      { type: 'rightclick', from: { x: 400, y: 250 } },
      { type: 'waitForText', text: 'Linear read vs ref' },
      { type: 'delay', ms: 800 },
    ],
  },

  // Variant feature-details panel for an SNV, with the per-sample genotype table
  // in the SAMPLES section. Opened by clicking the SNV's floating label.
  {
    mode: 'url',
    name: 'variant_panel',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:6257-6305',
          tracks: ['volvox_test_vcf'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'C -> T' },
      { type: 'waitForText', text: 'HG00096' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // The Filter by dialog (SAM flag bitmask editor), opened by driving the track
  // menu. Illustrates the "Filtering reads" section.
  {
    mode: 'url',
    name: 'alignments/filter_dialog',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_sv_cram'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Filter by' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Edit filters' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Group by strand: two session sub-tracks of volvox_sv_cram, one filtered to
  // forward reads and one to reverse (the same flag filters the Group by dialog
  // applies), each colored by strand so the split reads cleanly.
  {
    mode: 'url',
    name: 'alignments/group_by_strand',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_sv_cram_fwd',
          name: 'volvox-sv (+)',
          assemblyNames: ['volvox'],
          adapter: VOLVOX_SV_CRAM_ADAPTER,
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'volvox_sv_cram_rev',
          name: 'volvox-sv (-)',
          assemblyNames: ['volvox'],
          adapter: VOLVOX_SV_CRAM_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram_fwd',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                filterBy: { flagInclude: 0, flagExclude: 1556 },
                colorBy: { type: 'strand' },
                showLegend: false,
              },
            },
            {
              trackId: 'volvox_sv_cram_rev',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                filterBy: { flagInclude: 16, flagExclude: 1540 },
                colorBy: { type: 'strand' },
                showLegend: false,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 1000,
    settleMs: 5000,
  },

  {
    mode: 'url',
    name: 'dotplot',
    // use the full peach_grape.paf (grape_peach_paf), not the small in-repo paf
    // that the config defaultSession loads
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 8000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    url: sessionSpec(SYNTENY_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_tblastx'],
          // the subset peach_vs_grape.tsv only contains Pp05<->grape chr18
          // alignments, so this is the region pair that actually draws ribbons
          views: [
            { loc: 'Pp05:1-1100000', assembly: 'peach' },
            { loc: 'chr18:1-1000000', assembly: 'grape' },
          ],
        },
      ],
    }),
    // wait for the synteny ribbons to actually paint, else the panels capture
    // empty (the bug the review flagged)
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 30000,
    settleMs: 6000,
  },

  // Whole-genome human (hs1/T2T-CHM13) vs mouse (mm39) synteny, mirroring the
  // hs1_vs_mm39 config defaultSession: 500k minlen drops short-alignment
  // hairball noise, autoDiagonalize reorders mm39 chroms into clean diagonals,
  // and drawCurves + low alpha + per-query coloring give legible bezier ribbons
  // (matches data/hs1ToMm39/ribbon-500k.png reference). Remote UCSC liftOver PIF
  // + two 2bit genomes, so allow a long ready/settle.
  {
    mode: 'url',
    name: 'hs1_vs_mm39_synteny',
    url: sessionSpec(HS1_MM39_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['hs1ToMm39.over.chain.pif'],
          minAlignmentLength: 500000,
          drawCurves: true,
          autoDiagonalize: true,
          colorBy: 'query',
          alpha: 0.4,
          levelHeights: [350],
          views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        },
      ],
    }),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // Center line over a long-read SV CRAM. Migrated from a hand-captured shot —
  // showCenterLine is a view-level flag.
  {
    mode: 'url',
    name: 'alignments_center_line',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1000-1100',
          showCenterLine: true,
          tracks: ['volvox_bam'],
        },
      ],
    }),
    readyText: 'ctgA',
    // smaller window keeps focus on the center line over the pileup
    viewportWidth: 1100,
    viewportHeight: 650,
    settleMs: 4000,
  },

  // Sort by base pair at the center line. Migrated from a hand-captured shot —
  // sortedBy is the same override the "Sort by → Base pair" menu item writes.
  {
    mode: 'url',
    name: 'alignments_sort_by_base',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:14427-14534',
          showCenterLine: true,
          tracks: [
            {
              trackId: 'volvox_bam',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                sortedBy: {
                  type: 'basePair',
                  pos: 14481,
                  refName: 'ctgA',
                  assemblyName: 'volvox',
                },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // GAPDH (minus strand, chr12) — a single-strand, highly-expressed,
          // isolated gene so the RNA-seq sashimi arcs are all one strand color,
          // not the overlapping fwd/rev arcs the previous ACTB locus showed.
          loc: 'chr12:6,643,000-6,648,000',
          tracks: ['ncbi_gff_hg19', 'Pairend_StrandSpecific_51mer_Human_hg19'],
        },
      ],
    }),
    readyText: 'GAPDH',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr8:50,000,000-51,000,000',
          tracks: ['ncbi_gff_hg19', 'hic'],
        },
      ],
    }),
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // Gallery "CpG methylation" image: real COLO829_tumor nanopore reads colored
  // by methylation (red/blue marks) across UCSC CpG islands, the same data the
  // caption describes. Autogenerated from DEMO_CONFIG via a flat colorBy key in
  // the displaySnapshot.
  {
    mode: 'url',
    name: 'modifications',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:18,493,346-18,511,070',
          tracks: [
            'cpgisland_ucsc_hg38',
            {
              trackId: 'COLO829_tumor.ht',
              displaySnapshot: {
                colorBy: { type: 'methylation' },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    // deep remote nanopore CRAM + methylation processing is slow over the network
    settleMs: 35000,
  },

  // TODO: restore COLO829 methylation specs (methylation/per_read_mod_bam and
  // methylation/colo829_cram_and_bedmethyl) on COLO829_tumor.ht and
  // COLO829_tumor.ht_modkit.bed_multi from DEMO_CONFIG at
  // chr20:10,000,000-10,002,000. They used the old nested
  // displaySnapshot: { PileupDisplay: { colorBy: { type: 'methylation' } } },
  // which MST rejected. LinearAlignmentsDisplay takes flat overrides now
  // — displaySnapshot: { colorBy: { type: 'methylation' } }
  // — so these can be restored once the remote data is verified to load
  // headless (see inverted_duplication below for the working flat-override form).

  // Gallery page + sv_visualization.md screenshots (live sessions from jbrowse.org)

  {
    mode: 'url',
    name: 'sv_inspector_importform_loaded',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'hg19',
          uri: 'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
        },
      ],
    }),
    readyText: 'CHROM',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'sv_inspector_begin',
    url: sessionSpec(VOLVOX, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'horizontally_flip',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C',
    readyText: 'RefSeq',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Whole-genome CNV: COLO829 melanoma tumor (red) vs matched normal (blue)
  // coverage as a single multi-quantitative bigWig track, shown at chromosome
  // scale (no `loc` → showAllRegionsInAssembly) with localsd ±3sd autoscale so
  // copy-number gains/losses stand out. Rebuilt from the old server-side share
  // link as a self-contained sessionSpec/MultiWiggleAdapter over the two COLO829
  // coverage bigWigs in config_demo.json.
  {
    mode: 'url',
    name: 'cnv',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'colo829_cnv_coverage',
          name: 'COLO829 tumor/normal coverage',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                type: 'BigWigAdapter',
                source: 'COLO829 tumor',
                color: 'red',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                source: 'COLO829 normal',
                color: 'blue',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_normal.bw',
                  locationType: 'UriLocation',
                },
              },
            ],
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          tracks: [
            {
              trackId: 'colo829_cnv_coverage',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                autoscale: 'localsd',
                numStdDev: 3,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 15000,
    // the two-row track is short; crop off the empty viewport below it
    crop: { x: 0, y: 0, width: 1500, height: 390 },
  },

  // Curated: this shared session rendered correctly at the old 1280px viewport,
  // but at 1500px each breakpoint panel spans ~17% more bp, pushing the PacBio
  // CRAM past the "too much data" threshold so it force-loads instead of drawing
  // the reads + connecting splines the caption describes. The committed PNG is
  // the pre-regen capture; re-sharing the session at a tighter zoom would let
  // this autogen again.
  {
    mode: 'url',
    curated: true,
    name: 'skbr3_translocation',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l',
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'smalldel',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE',
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // The nssv15767046 insertion at ~1:55,705,920 (hg19) shown across HG002
  // nanopore (top), PacBio (middle), and Illumina (bottom) read tracks under the
  // HG002 dbVar variant call. Reconstructed from DEMO_CONFIG (was a share-link
  // that opened with the track selector covering the panel) so the sessionSpec
  // form opens with the selector closed. Same locus + nanopore/illumina/variant
  // tracks as insertion_indicators, plus the canonical 15kb GIAB PacBio track.
  {
    mode: 'url',
    name: 'insertion',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,705,770-55,706,090',
          tracks: [
            'nstd175.GRCh37.variant_call.vcf',
            'hg002_nanopore',
            'HG002.Sequel.15kb.pbmm2.hs37d5.whatshap.haplotag.RTG.10x.trio',
            'illumina_hg002',
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  {
    mode: 'url',
    name: 'multisv',
    url: 'https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw',
    readyText: '1KGP',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'breakpoint_split_view',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-ITpNXoz07O&password=Brtps',
    readyText: 'SKBR3',
    // both panels + connecting curves fit in ~850px; was 1200 which left a tall
    // band of empty whitespace below the lower panel
    viewportHeight: 900,
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Read-vs-reference of a SKBR3 PacBio read spanning a ~500bp insertion. The
  // shared session carries the dynamically-built LinearSyntenyView (read drawn
  // against a synthetic single-read assembly) below the pileup, which is too
  // tied to the clicked read's CIGAR to reconstruct as a plain session spec —
  // so this loads the saved session directly. The hand-captured original also
  // showed a click-and-drag sequence selection (blue) that this autogen omits.
  {
    mode: 'url',
    name: 'read_vs_ref_insertion',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe',
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Alignments-track doc screenshots, autogenerated from real-human data in
  // DEMO_CONFIG (SKBR3 illumina / HG002 multi-track / 1KGP) so the colored
  // clip+insertion indicators and short-vs-long-read comparison match the doc
  // captions.

  // Colored clip/insertion indicator ticks above the coverage of a SKBR3
  // illumina CRAM (blue = left-clip, red = right-clip, purple = insertion).
  {
    mode: 'url',
    name: 'alignment_clipping_indicators',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:22,518,136-22,546,627',
          tracks: [
            {
              trackId:
                'SKBR3_550bp_pcrFREE_S1_L001_AND_L002_R1_001.101bp.bwamem.ill.mapped.sort.cram',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                // taller coverage band so the small clip-indicator ticks above
                // it are large enough to read (default coverageHeight is 45)
                coverageHeight: 120,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  // Large-insertion indicator on HG002 long reads, with 'show soft clipping'
  // enabled on the short-read Illumina track below for comparison.
  {
    mode: 'url',
    name: 'insertion_indicators',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,705,770-55,706,090',
          tracks: [
            'nstd175.GRCh37.variant_call.vcf',
            'hg002_nanopore',
            {
              trackId: 'illumina_hg002',
              displaySnapshot: { showSoftClipping: true },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  // Inverted duplication (CPX/INVdup HGSV_2721) on real 1000-genomes data: the
  // HG02768 CRAM with linkedReads (mates drawn connected on one row) plus arc
  // read-connections and pair-orientation coloring makes the overlapping
  // inversion / tandem-dup pairing pattern visible, alongside the 1KGP ensemble
  // VCF call.
  // loc shifted ~600bp right so HGSV_2721 (near right of original range) sits
  // centered in the panel-narrowed view after the feature sidebar opens.
  {
    mode: 'url',
    name: 'inverted_duplication',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              displaySnapshot: {
                linkedReads: 'normal',
                readConnections: 'arc',
                readConnectionsDown: true,
                height: 400,
                colorBy: { type: 'pairOrientation' },
                featureHeight: 3,
                featureSpacing: 0,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    viewportHeight: 1100,
    settleMs: 25000,
    actions: [
      { type: 'click', selector: '[data-testid="feature-name-HGSV_2721"]' },
      { type: 'delay', ms: 4000 },
    ],
  },

  // Non-compact variant for side-by-side comparison with inverted_duplication.
  {
    mode: 'url',
    name: 'inverted_duplication/normal_height',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              displaySnapshot: {
                linkedReads: 'normal',
                readConnections: 'arc',
                readConnectionsDown: true,
                height: 900,
                colorBy: { type: 'pairOrientation' },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    viewportHeight: 1250,
    settleMs: 25000,
    actions: [
      { type: 'click', selector: '[data-testid="feature-name-HGSV_2721"]' },
      { type: 'delay', ms: 4000 },
    ],
  },

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl({
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    readyTimeout: 60000,
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_view',
    url: cgiabUrl({
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  {
    // The figure depicts the LGV import/start screen showing the "Show all
    // regions in assembly" button (per its caption). An LGV with an assembly
    // but no loc relies on afterAttach's showAllRegionsInAssembly, which races
    // the (slow, remote) assembly load and silently no-ops before regions are
    // ready — so instead launch an empty view and stop on the import form,
    // mirroring the lgv_assembly spec.
    mode: 'url',
    name: 'sv_cgiab/cnv_show_all_regions',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Launch view' },
      { type: 'waitForText', text: 'Show all regions in assembly' },
      { type: 'delay', ms: 2000 },
    ],
    // the import form is short; crop off the empty viewport below it
    crop: { x: 0, y: 0, width: 1500, height: 175 },
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
          name: 'HG008-T PacBio HiFi 116x',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:97050000-97400000',
          tracks: [
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
            'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:1-180915260',
          tracks: [
            'HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram.all',
            'GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    // wider viewport so the whole-chromosome CNV + bed track aren't cut off
    viewportWidth: 1800,
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_result',
    url: cgiabUrl({
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'HG008T.hap1' }, { assembly: 'GRCh38_GIABv3' }],
          tracks: ['HG008T.hap1'],
        },
      ],
    }),
    viewportWidth: 1800,
    // giant remote assembly PAF; needs a long settle for the dots to paint
    settleMs: 60000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/synteny_view',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['HG008T.hap1'],
          views: [
            {
              loc: 'chr3:1-198295559 chr13:1-114364328',
              assembly: 'GRCh38_GIABv3',
            },
            {
              loc: 'haplotype1-0000015:1-300000000 haplotype1-0000016:1-300000000',
              assembly: 'HG008T.hap1',
            },
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1800,
    // giant remote assembly PAF; synteny_canvas_done can exceed 90s, so settle
    // long rather than gate on it
    settleMs: 45000,
  },

  // H. pylori synteny tutorial (synteny_visualization.md) — live hpylori demo

  {
    mode: 'url',
    // assemblies intentionally not pre-set: supplying them auto-launches the
    // DotplotView, but this tutorial image is specifically the import form
    name: 'sv_synteny/dotplot_import',
    url: hpyloriUrl({ views: [{ type: 'DotplotView', views: [{}, {}] }] }),
    readyText: 'Select assemblies for dotplot view',
    readyTimeout: 60000,
    settleMs: 3000,
    annotations: [
      {
        type: 'text',
        x: 120,
        y: 110,
        text: 'Select the query (x-axis) assembly',
      },
      {
        type: 'arrow',
        from: { x: 300, y: 130 },
        anchor: { text: 'x-axis assembly' },
      },
      {
        type: 'text',
        x: 950,
        y: 110,
        text: 'Select the target (y-axis) assembly',
      },
      {
        type: 'arrow',
        from: { x: 1130, y: 130 },
        anchor: { text: 'y-axis assembly' },
      },
    ],
  },

  {
    mode: 'url',
    name: 'sv_synteny/dotplot',
    url: hpyloriUrl({
      views: [
        {
          type: 'DotplotView',
          tracks: ['26695_vs_j99.pif'],
          views: [{ assembly: 'hpylori_j99' }, { assembly: 'hpylori_26695' }],
        },
      ],
    }),
    settleMs: 18000,
  },

  {
    mode: 'url',
    name: 'sv_synteny/linear_synteny_genes',
    url: hpyloriSyntenyWithGenes(),
    readyText: 'NC_018939.1',
    readyTimeout: 60000,
    settleMs: 12000,
  },
  // Gene feature-details sequence panel: click the multi-exon EDEN gene to open
  // its details, expand "Show feature sequence", and switch the type selector to
  // the genomic-with-introns + up/down-stream mode so the panel shows the colored
  // upstream / exon / intron / downstream sequence the caption describes.
  {
    mode: 'url',
    name: 'feature_detail_sequence',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:17200-23200',
          tracks: [
            {
              trackId: 'gff3tabix_genes',
              displaySnapshot: { height: 300 },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      {
        type: 'click',
        text: 'Genomic w/ full introns +/- 100bp up+down stream',
      },
      { type: 'delay', ms: 3000 },
    ],
  },
  {
    mode: 'url',
    name: 'methylation/arabidopsis_chh',
    url: '?config=test_data/arabidopsis_methylation/config.json&sessionName=Screenshot',
    readyText: 'NC_003070',
    settleMs: 9000,
  },
  {
    mode: 'url',
    name: 'methylation/arabidopsis_bisulfite_chh',
    url: '?config=test_data/arabidopsis_methylation/config_emseq_bisulfite.json&sessionName=Screenshot',
    readyText: 'NC_003070',
    readyTimeout: 60000,
    settleMs: 14000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Basic UI guides
  // ────────────────────────────────────────────────────────────────────────

  // LGV usage guide: numbered callout badges anchored to the live toolbar
  // controls (so positions track the UI, no hand-tuned coords). (1) Add menu,
  // (2) pan buttons, (3) zoom controls, (4) track drag handle, (5) track menu,
  // (6) scroll-zoom toggle, (7) search box.
  {
    mode: 'url',
    name: 'lgv_usage_guide',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_cram_alignments'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    annotations: [
      { type: 'circle', text: '1', anchor: { text: 'Add' } },
      {
        type: 'circle',
        text: '2',
        anchor: { selector: 'button[aria-label="Pan left"]' },
      },
      {
        type: 'circle',
        text: '3',
        anchor: { selector: '[data-testid="zoom_in"]' },
      },
      {
        type: 'circle',
        text: '4',
        anchor: { selector: '[data-testid^="dragHandle-"]' },
      },
      {
        type: 'circle',
        text: '5',
        anchor: { selector: '[data-testid="track_menu_icon"]' },
      },
      {
        type: 'circle',
        text: '6',
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
      },
      {
        type: 'circle',
        text: '7',
        anchor: { selector: 'input[placeholder="Search for location"]' },
      },
    ],
  },

  // Add track: two-stage figure. Top frame opens the File menu with a box around
  // the "Open track..." item; bottom frame shows the AddTrackWidget drawer that
  // item opens.
  {
    mode: 'url',
    name: 'add_track_form',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    // smaller window so the File menu + add-track drawer are easy to read
    viewportWidth: 1000,
    viewportHeight: 720,
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 300 },
    ],
    stages: [
      {
        annotations: [{ type: 'box', anchor: { text: 'Open track...' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Open track...' },
          { type: 'waitForText', text: 'Enter track data' },
          { type: 'delay', ms: 1000 },
        ],
      },
    ],
  },

  // Track selector open, with callout badges pointing at (1) the track-selector
  // icon in the LGV header and (2) the add-track FAB. The FAB is left unclicked
  // so its popup menu doesn't cover it.
  {
    mode: 'url',
    name: 'add_track_tracklist',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      // open the track selector
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 800 },
    ],
    // ring each control (leaving the icon itself visible) with a text label
    // beside it, rather than a numbered badge centered on — and hiding — the icon
    annotations: [
      {
        type: 'box',
        anchor: { selector: 'button[title="Open track selector"]' },
      },
      {
        type: 'text',
        text: 'Track selector',
        anchor: { selector: 'button[title="Open track selector"]' },
        dx: 18,
        dy: 30,
      },
      {
        type: 'box',
        anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
      },
      {
        type: 'text',
        text: 'Add track',
        anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
        dx: -95,
        dy: 4,
      },
    ],
  },

  // Track menu: two-stage figure. Top frame opens the track selector and rings
  // both track-menu icons — the one on the LGV track label and the one on the
  // track-list entry. Bottom frame opens the track menu (from the LGV label)
  // with a box around it.
  {
    mode: 'url',
    name: 'track_menu',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_sv_test'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      // open the track selector so the track-list entry menu icon is visible
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // filter the (virtualized) list so the target row is rendered
      { type: 'type', text: 'Filter tracks', value: 'structural variant' },
      { type: 'delay', ms: 800 },
    ],
    stages: [
      {
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="track_menu_icon"]' },
          },
          {
            type: 'circle',
            anchor: {
              selector:
                '[data-testid="htsTrackEntryMenu-Tracks,volvox_sv_test"]',
            },
          },
        ],
      },
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'About track' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [{ type: 'box', anchor: { selector: 'ul[role="menu"]' } }],
      },
    ],
  },

  // Track label positioning submenu in the view menu.
  {
    mode: 'url',
    name: 'tracklabels',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes', 'volvox_sv_test'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Track labels' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Track labels' },
      { type: 'waitForText', text: 'Overlapping' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Track settings: track menu showing Settings and Copy track options,
  // illustrating that a track must be copied before its settings can be edited.
  {
    mode: 'url',
    name: 'edit_track_settings',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Track actions' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Track actions' },
      { type: 'waitForText', text: 'Settings' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Drawer widget position menu open (showing left/right options), triggered
  // by clicking the MoreVert icon in the drawer header.
  {
    mode: 'url',
    name: 'drawer_widget_toggle',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      // open the track selector to get a widget in the drawer
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // click the MoreVert to open the position menu
      { type: 'click', selector: '[data-testid="drawer-position-button"]' },
      { type: 'waitForText', text: 'left' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Share session dialog, opened from the Share button in the app header.
  {
    mode: 'url',
    name: 'share_button',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_cram_alignments'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="share-button"]' },
      { type: 'waitForText', text: 'Copy the URL below' },
      { type: 'waitForText', text: 'Generating', hidden: true },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Bookmark widget screenshots
  // ────────────────────────────────────────────────────────────────────────

  // How to open the bookmark widget: the view menu's Bookmarks/highlights submenu
  // open with the "Open bookmark widget" item hovered/highlighted (not clicked),
  // matching the origin/main figure that shows the menu path.
  {
    mode: 'url',
    name: 'bookmark_widget_open',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Bookmarks/highlights' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Bookmarks/highlights' },
      { type: 'waitForText', text: 'Open bookmark widget' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Open bookmark widget' },
      { type: 'delay', ms: 800 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Open bookmark widget' } }],
  },

  // Rubberband context menu with "Bookmark region" option visible.
  {
    mode: 'url',
    name: 'bookmark_widget_create',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Bookmark region' },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Bookmark region' } }],
  },

  // Bookmark widget with a bookmark label showing a highlight on the LGV.
  {
    mode: 'url',
    name: 'bookmark_widget_edit_label',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      // create a bookmark via rubberband
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Bookmark region' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Bookmark region' },
      { type: 'delay', ms: 500 },
      // open the bookmark widget
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Bookmarks/highlights' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Bookmarks/highlights' },
      { type: 'waitForText', text: 'Open bookmark widget' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open bookmark widget' },
      { type: 'waitForText', text: 'ctgA' },
      { type: 'delay', ms: 1000 },
      // single-click the "Add label..." cell to enter edit mode, then type
      { type: 'type', text: 'Add label...', value: 'my region' },
      { type: 'delay', ms: 1500 },
    ],
    // anchor to the "Label" column header in the bookmark widget (the edited
    // value lives in an <input>, which has no textContent to anchor to, so the
    // old anchor fell back to the top-left corner)
    annotations: [
      {
        type: 'text',
        text: 'Single-click the label to edit it',
        anchor: { text: 'Bookmark link' },
        dx: -10,
        dy: 70,
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Alignments track interactions
  // ────────────────────────────────────────────────────────────────────────

  // Compact read drawing on real human data: HG002 Illumina hs37d5 2x250 (high
  // coverage, so the difference compact mode makes is obvious). The display is
  // preset to the compact preset (featureHeight 3 / spacing 0) so the pileup is
  // already drawn compact; the track menu is opened to the "Set feature height..."
  // submenu with the now-active Compact option boxed — i.e. the toggled state and
  // the menu path that sets it, in one figure. Remote DEMO_CONFIG data.
  {
    mode: 'url',
    name: 'alignments/compact',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,704,500-55,707,500',
          tracks: [
            {
              trackId: 'illumina_hg002',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                featureHeight: 3,
                featureSpacing: 0,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Set feature height...' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Set feature height...' },
      { type: 'waitForText', text: 'Compact' },
      { type: 'delay', ms: 800 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Compact' } }],
  },

  // Read connections (arc display): two-stage figure on the volvox-sv CRAM (whose
  // discordant pairs make the arcs meaningful). Top frame: the track menu opened
  // to the "Read connections → Show pair overlay" submenu (where the Arcs option
  // lives) with it boxed. Bottom frame: the arcs themselves (readConnections is
  // preset to 'arc' so they render in the result frame).
  {
    mode: 'url',
    name: 'alignments/select_arc_display',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                readConnections: 'arc',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Read connections' },
          { type: 'delay', ms: 300 },
          { type: 'hover', text: 'Read connections' },
          { type: 'waitForText', text: 'Show pair overlay' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Show pair overlay' } }],
      },
      {
        // click the location box to dismiss the (nested) menu before the result
        // frame — a single Escape only closes the innermost submenu
        actions: [
          {
            type: 'click',
            selector: 'input[placeholder="Search for location"]',
          },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // Track menu showing the Color scheme > Modifications option, over the real
  // chr20 5mC/5hmC CRAM from the demo config (the MM/ML-tagged example the doc
  // describes), at the CpG-island locus used by the methylation figures.
  {
    mode: 'url',
    name: 'alignments/modifications1',
    // zoomed to ~5kb so the CRAM force-loads (the wider window tripped the
    // "region too large" guard and the modifications never loaded, leaving the
    // submenu stuck on "Loading modifications...")
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '20:19,757,000-19,762,000',
          tracks: ['human_chr20_mod_call_5mC_5hmC_CG_cram'],
        },
      ],
    }),
    readyText: 'human_chr20',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Color by...' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Color by...' },
      { type: 'waitForText', text: 'Base modifications (MM tag)' },
      { type: 'delay', ms: 500 },
      { type: 'hover', text: 'Base modifications (MM tag)' },
      { type: 'waitForText', text: 'By modification type' },
      { type: 'delay', ms: 800 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'By modification type' } }],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Track selector interactions
  // ────────────────────────────────────────────────────────────────────────

  // Track selector hamburger menu showing settings options.
  {
    mode: 'url',
    name: 'hierarchical/hierarchical_user_menu-fs8',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      // open the track selector
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // open the hamburger menu, then open the Collapse... submenu so its
      // options are visible alongside the main menu
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      { type: 'waitForText', text: 'Collapse...' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Collapse...' },
      { type: 'waitForText', text: 'Collapse top-level categories' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Recently used tracks: two-stage figure. The session starts with no tracks
  // open; the shared actions open a track *through the track-selector UI* (click
  // its checkbox), which is what actually populates the recently-used list
  // (pre-opening tracks via the session does not). Top frame rings the
  // recently-used (clock) button; bottom frame opens its dropdown showing the
  // just-opened track.
  {
    mode: 'url',
    name: 'recent_tracks',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      // open the track selector directly via the header button — with no tracks
      // active the view body also renders an "Open track selector" button, so a
      // text-based click is ambiguous; the header button's title is unique
      { type: 'click', selector: 'button[title="Open track selector"]' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // filter the (virtualized) list so the target row is rendered
      { type: 'type', text: 'Filter tracks', value: 'GFF3Tabix' },
      { type: 'delay', ms: 800 },
      // open the track via the UI so it lands in "recently used"
      {
        type: 'click',
        selector: '[data-testid="htsTrackLabel-Tracks,gff3tabix_genes"]',
      },
      { type: 'delay', ms: 800 },
    ],
    stages: [
      {
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector: '[data-testid="recently-used-tracks-button"]',
            },
          },
        ],
      },
      {
        actions: [
          {
            type: 'click',
            selector: '[data-testid="recently-used-tracks-button"]',
          },
          { type: 'waitForText', text: 'GFF3Tabix genes' },
          { type: 'delay', ms: 500 },
        ],
      },
    ],
  },

  // Favorite tracks: two-stage figure. Top frame shows the per-track menu's
  // "Add to favorites" item with a ring around the Favorites (star) button;
  // bottom frame shows the resulting Favorites dropdown.
  {
    mode: 'url',
    name: 'favorite_tracks',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      // open track selector
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // filter the (virtualized) list so the target row is rendered
      { type: 'type', text: 'Filter tracks', value: 'GFF3Tabix' },
      { type: 'delay', ms: 800 },
      // open the track's per-track menu (showing "Add to favorites")
      {
        type: 'click',
        selector: '[data-testid="htsTrackEntryMenu-Tracks,gff3tabix_genes"]',
      },
      { type: 'waitForText', text: 'Add to favorites' },
      { type: 'delay', ms: 300 },
    ],
    stages: [
      {
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="favorite-tracks-button"]' },
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add to favorites' },
          { type: 'delay', ms: 500 },
          { type: 'click', selector: '[data-testid="favorite-tracks-button"]' },
          { type: 'waitForText', text: 'GFF3Tabix genes' },
          { type: 'delay', ms: 500 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Multi-quantitative (MultiWig) screenshots
  // ────────────────────────────────────────────────────────────────────────

  // MultiWig track menu showing the renderer type submenu.
  {
    mode: 'url',
    name: 'multiwig/multi_renderer_types',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_microarray_multi'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Rendering type' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Rendering type' },
      { type: 'waitForText', text: 'Multi-row XY plot' },
      { type: 'delay', ms: 500 },
    ],
  },

  // MultiWig color/arrangement editor dialog, over the ENCODE multi-bigWig demo
  // track (microarray_multi) from config_demo.json.
  {
    mode: 'url',
    name: 'multiwig/multi_colorselect',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:1,000,000-2,000,000',
          tracks: ['microarray_multi'],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Edit colors/arrangement...' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Edit colors/arrangement...' },
      { type: 'waitForText', text: 'Multi-wiggle color/arrangement editor' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Add track dialog showing the multi-wiggle workflow selector.
  {
    mode: 'url',
    name: 'multiwig/addtrack',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      { type: 'delay', ms: 500 },
      // open the workflow selector dropdown (shows its current value as text)
      { type: 'click', text: 'Add a track from file or URL' },
      { type: 'waitForText', text: 'Add multi-wiggle track' },
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      {
        type: 'text',
        x: 520,
        y: 150,
        text: 'Use this dropdown to access alternative add-track workflows for adding multi-wiggle tracks',
      },
      {
        type: 'arrow',
        from: { x: 900, y: 165 },
        anchor: { selector: '[aria-expanded="true"]' },
      },
    ],
  },

  // Rendered multi-row XY output (the default mode): one XY plot per subtrack,
  // stacked, each keeping its configured color. Pairs with multiwig/overlapping
  // for the doc's "two families" contrast.
  {
    mode: 'url',
    name: 'multiwig/multirow_xy',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_microarray_multi'],
        },
      ],
    }),
    readyText: 'ctgA',
    readySelector: '[data-testid="multi-wiggle-display-done"]',
    viewportHeight: 600,
    settleMs: 4000,
  },

  // Rendered overlapping output: all subtracks drawn together in one plot with
  // auto-assigned palette colors. defaultRendering override drives the same
  // switch the track menu's "Rendering type" submenu writes.
  {
    mode: 'url',
    name: 'multiwig/overlapping',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_microarray_multi',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                // override keys serialize flat on the snapshot (see
                // ConfigOverrideMixin), not nested under configOverrides
                defaultRendering: 'multixyplot',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    readySelector: '[data-testid="multi-wiggle-display-done"]',
    viewportHeight: 600,
    settleMs: 4000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // GWAS / Manhattan plot
  // ────────────────────────────────────────────────────────────────────────

  // Manhattan plot rendered from the local volvox GWAS track (-log10 p on Y,
  // genomic position on X). Local data, so fast + deterministic. Waits on the
  // per-display canvasDrawn testid like the browser-tests gwas suite.
  {
    mode: 'url',
    name: 'gwas/manhattan',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: ['volvox_gwas'],
        },
      ],
    }),
    readyText: 'ctgA',
    readySelector: '[data-testid="manhattan-display-done"]',
    viewportHeight: 500,
    settleMs: 4000,
  },

  // LocusZoom-style LD r² coloring at the STAT4 locus on hg19 (SLE summary
  // stats). The index SNP auto-tracks the top hit (the lead rs4274624 the
  // bundled SLE.ld is keyed to), so points shade red→blue by r² to it on load
  // with no interaction.
  {
    mode: 'url',
    name: 'gwas/locuszoom_ld',
    url: sessionSpec('test_data/config_gwas.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '2:191,790,000-192,120,000',
          tracks: [
            {
              trackId: 'sle_gwas_ld',
              displaySnapshot: { type: 'LinearManhattanDisplay', height: 380 },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 60000,
    viewportHeight: 480,
    // settle past the index auto-pick + recolor fetch that follows first paint
    settleMs: 12000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Plugin store
  // ────────────────────────────────────────────────────────────────────────

  // Plugin store dialog opened from the Tools menu.
  {
    mode: 'url',
    name: 'plugin_store',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Installed plugins' },
      { type: 'delay', ms: 2000 },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Dotplot / synteny interactions
  // ────────────────────────────────────────────────────────────────────────

  // Add menu -> Dotplot view, then the resulting dotplot import form. (Close the
  // linear genome view first in real usage; here the import form is what the
  // caption points at.)
  {
    mode: 'url',
    name: 'dotplot_add',
    url: `?config=${VOLVOX}&sessionName=Screenshot`,
    readyText: 'ctgA',
    settleMs: 2500,
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Dotplot view' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Dotplot view' },
      { type: 'waitForText', text: 'Select assemblies for dotplot view' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Dotplot view hamburger menu showing view-specific options.
  {
    mode: 'url',
    name: 'dotplot_menu',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 3000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Two-stage figure: (top) dotplot drag-selection context menu showing "Open
  // linear synteny view", (bottom) the linear synteny view it launches.
  {
    mode: 'url',
    name: 'synteny_from_dotplot_view',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: ['grape_peach_paf'],
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 5000,
    actions: [
      // rubberband-drag on the dotplot canvas area (approximate center coords)
      { type: 'drag', from: { x: 400, y: 250 }, to: { x: 700, y: 450 } },
      { type: 'waitForText', text: 'Open linear synteny view' },
      { type: 'delay', ms: 1000 },
    ],
    stages: [
      // top frame: the context menu left open by the shared actions above
      {},
      // bottom frame: launch the linear synteny view and let it draw
      {
        actions: [
          { type: 'click', text: 'Open linear synteny view' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="synteny_canvas_done"]',
          },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // RNA-seq tutorial screenshots (use hg19 ACTB region from DEMO_CONFIG)
  // ────────────────────────────────────────────────────────────────────────

  {
    mode: 'url',
    name: 'rnaseq/overview',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr7:5,562,000-5,575,000',
          tracks: ['ncbi_gff_hg19', 'Pairend_StrandSpecific_51mer_Human_hg19'],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'rnaseq/reads_zoomed',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr7:5,568,000-5,569,000',
          tracks: ['ncbi_gff_hg19', 'Pairend_StrandSpecific_51mer_Human_hg19'],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'rnaseq/compact_stacked',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr7:5,566,500-5,570,500',
          tracks: [
            'ncbi_gff_hg19',
            {
              trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
              displaySnapshot: { featureHeight: 3, featureSpacing: 0 },
            },
          ],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Long-read IsoSeq RNA-seq at ACTB.
  {
    mode: 'url',
    name: 'rnaseq/longread_isoseq',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr7:5,566,000-5,571,000',
          tracks: ['ncbi_gff_hg19', 'hg_isoforms.fasta_bam'],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Phased trio analysis tutorial screenshots
  // ────────────────────────────────────────────────────────────────────────

  // Initial VCF load with default (LinearVariantDisplay) display.
  {
    mode: 'url',
    name: 'trio-basic',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:1-500,000',
          tracks: ['HG02024_VN049_KHVTrio.chr1.vcf'],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Multi-sample variant display (matrix view), with the track menu open on the
  // Display types submenu showing the "(matrix)" option highlighted.
  {
    mode: 'url',
    name: 'trio-matrix',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:62,174,000-65,097,304',
          tracks: [
            {
              trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
              displaySnapshot: {
                type: 'LinearMultiSampleVariantMatrixDisplay',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Display types' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Display types' },
      { type: 'waitForText', text: 'Multi-sample variant display (matrix)' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Phased matrix with the "Rendering mode" menu visible.
  {
    mode: 'url',
    name: 'trio-matrix-phased',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:62,174,000-65,097,304',
          tracks: [
            {
              trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
              displaySnapshot: {
                type: 'LinearMultiSampleVariantMatrixDisplay',
                renderingMode: 'phased',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Rendering mode' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Rendering mode' },
      { type: 'waitForText', text: 'Phased' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Phased matrix clean (no menu overlay).
  {
    mode: 'url',
    name: 'trio-matrix-phased-clean',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:62,174,000-65,097,304',
          tracks: [
            {
              trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
              displaySnapshot: {
                type: 'LinearMultiSampleVariantMatrixDisplay',
                renderingMode: 'phased',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Previously hand-captured UI-guide figures, now autogenerated
  // ────────────────────────────────────────────────────────────────────────

  // SV inspector import form (sv_inspector_view.md getting-started figure) —
  // the empty SpreadsheetImportWidget the SvInspectorView opens with.
  {
    mode: 'url',
    name: 'sv_inspector_importform',
    url: sessionSpec(VOLVOX, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    settleMs: 3000,
  },

  // LGV assembly/sequence import form (quickstart_web.md) — a linear genome view
  // with an assembly but no region opens on the assembly + sequence selectors.
  {
    mode: 'url',
    name: 'lgv_assembly',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Launch view' },
      { type: 'waitForText', text: 'Select assembly to view' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Assembly manager dialog (quickstart_adminserver.md) opened from the Tools
  // menu over config_demo, whose hg19/hg38/hs1 human assemblies populate the
  // table. The Assembly manager menu item is not admin-gated, so this is
  // reproducible headless without an admin server.
  {
    mode: 'url',
    name: 'add_hg38_assembly',
    url: sessionSpec(DEMO_CONFIG, { views: [] }),
    readyText: 'Select a view to launch',
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Sample-configuration start state (quickstart_web.md) — volvox loaded with the
  // track selector open so the available tracks are visible.
  {
    mode: 'url',
    name: 'sample_config',
    url: sessionSpec(VOLVOX, {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Customized feature details (customizing_feature_details.md) — volvox's
  // gff3tabix_genes track config carries a formatDetails JEXL callback that links
  // the name to a Google search, adds a custom "extrafield", and drops the type
  // field; clicking a gene shows the resulting panel.
  {
    mode: 'url',
    name: 'customized_feature_details',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:17200-23200',
          tracks: [
            { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'extrafield' },
      { type: 'delay', ms: 2000 },
    ],
    annotations: [
      // ring the formatDetails-generated hyperlink in the feature-details panel
      {
        type: 'circle',
        anchor: { selector: 'a[href^="https://google.com/?q="]' },
      },
      {
        type: 'text',
        x: 760,
        y: 150,
        text: 'The callback turns the name into a clickable link',
      },
      {
        type: 'arrow',
        from: { x: 900, y: 165 },
        anchor: { selector: 'a[href^="https://google.com/?q="]' },
      },
    ],
  },

  // Feature-details upstream/downstream sequence panel (v1.1.0 blog post) — the
  // multi-exon volvox EDEN gene with "Show feature sequence" expanded into the
  // genomic-with-introns + up/down-stream mode so the colored upstream / exon /
  // intron / downstream sequence is shown.
  {
    mode: 'url',
    name: 'upstream_downstream_details',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:17200-23200',
          tracks: [
            { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      {
        type: 'click',
        text: 'Genomic w/ full introns +/- 100bp up+down stream',
      },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Track selector with all top-level categories collapsed (track_selector.md) —
  // driven through the hamburger menu's "Collapse..." submenu instead of a
  // config so it stays on plain volvox.
  {
    mode: 'url',
    name: 'hierarchical/collapse_toplevelcategories-fs8',
    url: sessionSpec(VOLVOX, {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      { type: 'waitForText', text: 'Collapse...' },
      { type: 'hover', text: 'Collapse...' },
      { type: 'waitForText', text: 'Collapse top-level categories' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Collapse top-level categories' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Track selector with all sub-categories collapsed (track_selector.md) — the
  // top-level categories stay open but their nested subcategory headers collapse.
  {
    mode: 'url',
    name: 'hierarchical/collapse_subcategories-fs8',
    url: sessionSpec(VOLVOX, {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      { type: 'waitForText', text: 'Collapse...' },
      { type: 'hover', text: 'Collapse...' },
      { type: 'waitForText', text: 'Collapse subcategories' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Collapse subcategories' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Cytoband ideogram in the overview scale bar (v1.5.1 blog post) — hg19 from
  // the demo config (which carries a cytobands adapter) zoomed to a chr1 region.
  {
    mode: 'url',
    name: 'cytobands',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:38,543,322-41,918,323',
          tracks: ['ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // SV inspector import form with a VCF URL pasted (sv_inspector_view.md) — the
  // SKBR3 Sniffles translocation calls typed into the URL field before opening.
  {
    mode: 'url',
    name: 'sv_inspector_importform_after',
    url: sessionSpec(DEMO_CONFIG, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'VCF' },
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value:
          'https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf',
      },
      { type: 'delay', ms: 1500 },
    ],
    // also call out the "Open from track" workflow: instead of pasting a URL you
    // can populate the inspector from a VCF track already open in the session
    annotations: [
      {
        type: 'arrow',
        from: { x: 720, y: 430 },
        anchor: { text: 'Open from track' },
      },
      {
        type: 'text',
        text: 'You can also load SV calls from a VCF track already in the session',
        anchor: { text: 'Open from track' },
        dx: -140,
        dy: 90,
      },
    ],
  },

  // Default UI theme (theme.md) — a small volvox config with the track selector
  // open so the default primary/secondary/tertiary/quaternary palette is shown.
  {
    mode: 'url',
    name: 'default_theme',
    url: sessionSpec('test_data/volvox/config_theme_default.json', {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Customized UI theme (theme.md) — same config carrying the documented custom
  // palette (#311b92 / #0097a7 / #f57c00 / #d50000) via configuration.theme.
  {
    mode: 'url',
    name: 'customized_theme',
    url: sessionSpec('test_data/volvox/config_theme_custom.json', {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },
]

// jbrowse.org hosts the same test_data/ configs (and the cgiab/hpylori demos)
// these specs load, so every spec's session can be opened as a live, clickable
// instance. The website Figure macro uses screenshotLiveUrls to link each
// screenshot to the running view that produced it.
const JBROWSE_LATEST = 'https://jbrowse.org/code/jb2/latest/'

export function specLiveUrl(spec: ScreenshotSpec): string | undefined {
  return spec.mode === 'url'
    ? spec.url.startsWith('http')
      ? spec.url
      : `${JBROWSE_LATEST}${spec.url}`
    : undefined
}

// screenshot name -> live-instance URL (all current specs are url-mode)
export const screenshotLiveUrls: Record<string, string> = Object.fromEntries(
  specs.flatMap(spec => {
    const url = specLiveUrl(spec)
    return url ? [[spec.name, url] as const] : []
  }),
)
