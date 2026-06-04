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
export interface Annotation {
  type: 'arrow' | 'box' | 'text'
  // arrow: tail -> head; box uses x/y/width/height; text uses x/y as baseline
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color?: string // default red (#e3242b)
  fontSize?: number // text, default 18
}

interface CommonSpecFields {
  // committed PNG is a hand-curated / real-human-data screenshot the spec body
  // can't reproduce; the generator skips it so a regen never clobbers it
  curated?: boolean
  // capture-viewport height in CSS px for this spec (default 800); raise it for
  // tall multi-row pileups so the track isn't clipped by the default viewport
  viewportHeight?: number
  // callouts drawn over the page before capture (arrows/boxes/text)
  annotations?: Annotation[]
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
// url), so new display settings like configOverrides/readConnections render —
// jbrowse.org/code/jb2/latest is an older release that ignores them. specLiveUrl
// still turns this into a jbrowse.org link for readers.
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
          loc: 'ctgA:1-10000',
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

  {
    mode: 'url',
    name: 'alignments/arc_display',
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
                pairedArcs: 'up',
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
    name: 'alignments/read_cloud',
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
                pairedArcs: 'samplot',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  // Paired-end reads colored by insert size on the volvox synthetic-SV CRAM:
  // pairs whose mates map an unexpected distance apart stand out against the
  // background. Same track/region as the arc + read-cloud specs above.
  {
    mode: 'url',
    name: 'alignments/color_by_insert_size',
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
                configOverrides: { colorBy: { type: 'insertSize' } },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
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
      { type: 'delay', ms: 500 },
    ],
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
          loc: 'ctgA:1000-3000',
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
                configOverrides: {
                  filterBy: { flagInclude: 0, flagExclude: 1556 },
                  colorBy: { type: 'strand' },
                },
              },
            },
            {
              trackId: 'volvox_sv_cram_rev',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                configOverrides: {
                  filterBy: { flagInclude: 16, flagExclude: 1540 },
                  colorBy: { type: 'strand' },
                },
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
    url: `?config=${DOTPLOT_CONFIG}&sessionName=Screenshot`,
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 30000,
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    url: sessionSpec(SYNTENY_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_tblastx'],
          views: [
            { loc: 'Pp01:1-5000000', assembly: 'peach' },
            { loc: 'chr1:1-5000000', assembly: 'grape' },
          ],
        },
      ],
    }),
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
          loc: 'ctgA:2636-2746',
          showCenterLine: true,
          tracks: ['volvox-long-reads-sv-cram'],
        },
      ],
    }),
    readyText: 'ctgA',
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
                configOverrides: {
                  sortedBy: {
                    type: 'basePair',
                    pos: 14481,
                    refName: 'ctgA',
                    assemblyName: 'volvox',
                  },
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
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['spliced'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr8:48,000,000-68,000,000',
          tracks: ['ncbi_gff_hg19', 'hic'],
        },
      ],
    }),
    readySelector: '[data-testid="hic_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // Gallery "CpG methylation" image: real COLO829_tumor nanopore reads colored
  // by methylation (red/blue marks) across UCSC CpG islands, the same data the
  // caption describes. Autogenerated from DEMO_CONFIG via the flat
  // configOverrides.colorBy override.
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
                configOverrides: { colorBy: { type: 'methylation' } },
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
  // which MST rejected. LinearAlignmentsDisplay now takes flat overrides instead
  // — displaySnapshot: { configOverrides: { colorBy: { type: 'methylation' } } }
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

  {
    mode: 'url',
    name: 'cnv',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64',
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 12000,
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

  {
    mode: 'url',
    name: 'insertion',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    readyText: 'HG002',
    settleMs: 12000,
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
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
    readyText: 'SKBR3',
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
            'SKBR3_550bp_pcrFREE_S1_L001_AND_L002_R1_001.101bp.bwamem.ill.mapped.sort.cram',
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
                heightPreConfig: 400,
                configOverrides: {
                  colorBy: { type: 'pairOrientation' },
                  featureHeight: 3,
                  featureSpacing: 0,
                },
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
                heightPreConfig: 900,
                configOverrides: { colorBy: { type: 'pairOrientation' } },
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
    mode: 'url',
    name: 'sv_cgiab/cnv_show_all_regions',
    url: cgiabUrl({
      views: [{ type: 'LinearGenomeView', assembly: 'GRCh38_GIABv3' }],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 3000,
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
    settleMs: 20000,
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
    readyTimeout: 60000,
    settleMs: 15000,
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
