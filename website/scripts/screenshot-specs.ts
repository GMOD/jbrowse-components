import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

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
  // for 'text': draw a rounded filled pill behind the label (any CSS color, e.g.
  // 'rgba(0,0,0,0.78)') so callout text stays readable over busy page content
  background?: string
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
const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
const DEMO_CONFIG = 'test_data/config_demo.json'
const CGIAB_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json'
const HPYLORI_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/hpylori/config.json'

function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

function cgiabUrl(session?: object) {
  if (!session) {
    return CGIAB_BASE
  }
  return `${CGIAB_BASE}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

function hpyloriUrl(session: object) {
  return `${HPYLORI_BASE}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// remote 1000-genomes config loaded against the *local* build (a bare ?config=
// url), so new display settings like readConnections render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns
// this into a jbrowse.org link for readers.
const KG_CONFIG =
  'https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json'

function kgUrl(session: object) {
  return `?config=${encodeURIComponent(KG_CONFIG)}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
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
          loc: 'ctgA:14439-14515',
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

  // Whole-genome coverage profile from a single BigWig (COLO829 tumor MinION
  // coverage), each chromosome a separate region (no `loc` →
  // showAllRegionsInAssembly), localsd ±3sd autoscale so copy-number gains/losses
  // read as elevated/depressed signal. Rebuilt from the old server-side share
  // link as a self-contained sessionSpec; cropped to the single short track.
  {
    mode: 'url',
    name: 'bigwig/whole_genome_coverage',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          tracks: [
            {
              trackId: 'colo_tumor',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                autoscale: 'localsd',
                numStdDev: 3,
                // scatter rendering reads copy-number gains/losses better than
                // the filled XY plot across the whole genome (reviewer request)
                defaultRendering: 'scatter',
                // finer binning (basesPerSpan = bpPerPx/resolution) so the
                // whole-genome scatter resolves copy-number structure (reviewer)
                resolution: 5,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 15000,
    crop: { x: 0, y: 0, width: 1500, height: 320 },
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

  // Realistic arc display on HG002 (reviewer asked for HG002 Illumina reads +
  // HG002 SV calls instead of SKBR3). The window is centered on a ~1.4 kb GIAB
  // Tier-1 deletion at chr1:1,285,401-1,286,800: HG002 Illumina 2x250 pairs that
  // span the deletion get a larger-than-expected insert size, so readConnections:
  // 'arc' draws them as the long red discordant arcs over the deletion while
  // concordant pairs stay small grey arcs. The HG002 GIAB consensus SV VCF sits
  // on top so the called deletion lines up with the arc signature. Window kept
  // under AUTO_FORCE_LOAD_BP (20kb) so the BAM loads without a force-load click.
  // Remote DEMO_CONFIG data, slow to load.
  {
    mode: 'url',
    name: 'alignments/arc_display',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:1,283,500-1,288,700',
          tracks: [
            'variants_hg002',
            {
              trackId: 'illumina_hg002',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                readConnections: 'arc',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002 Illumina',
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
  // matching features from the assembly's text-search index. Uses config_demo's
  // hg19 (whose trix index covers RefSeq/Gencode names) searching "brca".
  {
    mode: 'url',
    name: 'searching_lgv',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:1-100,000',
          tracks: ['ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 8000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'brca',
        clear: true,
      },
      { type: 'waitForText', text: 'BRCA1' },
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
    annotations: [{ type: 'box', anchor: { text: 'Zoom to region' } }],
  },

  // Soft clipping, two-stage figure: top frame opens the track menu's "Show..."
  // submenu with "Show soft clipping" boxed — soft clipping is NOT yet enabled,
  // so the reads render normally (clipped bases hidden). Bottom frame clicks the
  // item, enabling soft clipping and closing the menu, so it teaches cause→effect
  // (reviewer: stage 1 must be the not-yet-enabled state, stage 2 the result with
  // no menu open). Combines the old separate menu + result screenshots.
  {
    mode: 'url',
    name: 'alignments_soft_clipped_menu',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          // zoomed in toward the soft-clip breakpoint (reviewer request)
          loc: 'ctgA:2670-2730',
          tracks: ['volvox-long-reads-sv-bam'],
        },
      ],
    }),
    readyText: 'ctgA',
    // narrower window keeps the breakpoint in focus (reviewer request)
    viewportWidth: 900,
    settleMs: 4000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'delay', ms: 500 },
          { type: 'hover', text: 'Show...' },
          { type: 'waitForText', text: 'Show soft clipping' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Show soft clipping' } }],
      },
      {
        // click the boxed item to actually enable soft clipping; the menu closes
        // on click, so the result frame shows the soft-clipped reads with no menu
        actions: [
          { type: 'click', text: 'Show soft clipping' },
          { type: 'waitForText', text: 'Show soft clipping', hidden: true },
          { type: 'hover', from: { x: 200, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
      },
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
  // in the SAMPLES section. The variant has no ID, so its only floating label is
  // the description ("C -> T"); clicking it opens the details panel.
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
    // ring the SAMPLES section (the per-sample genotype table)
    annotations: [
      { type: 'box', anchor: { selector: '[data-testid="BaseCard-Samples"]' } },
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

  // Group by HP (haplotype) tag, two-stage figure on the rehosted HG002
  // haplotagged PacBio slice (HP:1 / HP:2 phased reads). Top frame drives the
  // track menu's "Group by..." → "Group by tag or strand..." dialog, picks the
  // Tag option and enters HP; bottom frame submits, which spawns one subtrack
  // per haplotype value (the feature's actual behavior — reviewer wanted the
  // menu option shown and the subtrack launch explained).
  {
    mode: 'url',
    name: 'alignments/group_by_hp',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_pacbio_hp_slice',
          name: 'HG002 PacBio (haplotagged)',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam.bai',
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
          assembly: 'hg19',
          loc: '1:55,705,500-55,707,500',
          tracks: [
            {
              trackId: 'hg002_pacbio_hp_slice',
              displaySnapshot: { type: 'LinearAlignmentsDisplay', height: 130 },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    viewportHeight: 900,
    settleMs: 12000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Group by...' },
          { type: 'delay', ms: 300 },
          { type: 'hover', text: 'Group by...' },
          { type: 'waitForText', text: 'Group by tag or strand...' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Group by tag or strand...' },
          { type: 'waitForText', text: 'creates one new session track' },
          { type: 'delay', ms: 500 },
          { type: 'click', selector: '[role="dialog"] [role="combobox"]' },
          { type: 'waitForText', text: 'Tag' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Tag' },
          {
            type: 'type',
            selector: '[data-testid="group-tag-name-input"]',
            value: 'HP',
          },
          { type: 'waitForText', text: 'Found unique' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'text',
            x: 60,
            y: 120,
            text: 'Group by the HP tag launches one subtrack per haplotype',
            background: 'rgba(0,0,0,0.78)',
            textColor: '#fff',
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Submit' },
          { type: 'waitForText', text: 'HP:1' },
          { type: 'delay', ms: 7000 },
        ],
      },
    ],
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
    // Faithful rebuild of the gallery.md share link (share-4MjF5YGM_G): the
    // MCScan grape/peach synteny over whole chromosomes (peach Pp05 vs grape
    // chr2) with curved ribbons. Uses config_dotplot.json (the share's config),
    // both MCScan synteny tracks between the panels, and the simple-anchors
    // track inside each panel — not the dense zoomed minimap2 the reviewer
    // rejected.
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          drawCurves: true,
          // taller synteny ribbon band between the panels (reviewer: ~250)
          levelHeights: [250],
          tracks: [
            'grape_peach_synteny_mcscan',
            'grape_peach_synteny_mcscan_simple',
          ],
          views: [
            {
              loc: 'Pp05:1-18496696',
              assembly: 'peach',
              tracks: ['grape_peach_synteny_mcscan_simple'],
            },
            {
              loc: 'chr2:1-18779844',
              assembly: 'grape',
              tracks: ['grape_peach_synteny_mcscan_simple'],
            },
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

  // Center line over the pileup (single static frame; the reviewer found the
  // two-stage menu+result version unnecessary — the plain center-line shot is
  // enough to illustrate the feature).
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

  // Sort by base at a SNP, showing the right-click workflow (reviewer wanted the
  // menu over the SNP captured, not just the declarative result). The view is
  // centered on the ctgA:14481 SNP (a green-A mismatch column) with the reads
  // already sorted by that base, so the variant reads cluster at the top — a
  // right-click there reliably lands on a mismatch and opens the read context
  // menu's "SNP/Mismatch → Sort by base at position" submenu, boxed here.
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
    // narrower window (reviewer request); the rightclick x below is recomputed
    // for this width — the SNP at ctgA:14481 sits at ~0.51 of the 107bp region
    viewportWidth: 1100,
    // crop each stage to the populated header+pileup so the stacked two-frame
    // figure isn't padded by the empty viewport below (reviewer: shorter window)
    crop: { x: 0, y: 0, width: 1100, height: 430 },
    settleMs: 5000,
    hideTooltip: true,
    // two-stage: top frame is the right-click "SNP/Mismatch → Sort by base at
    // position" menu; bottom frame closes the menu to show the resulting sorted
    // pileup (reads carrying the same base at ctgA:14481 grouped together)
    stages: [
      {
        actions: [
          { type: 'rightclick', from: { x: 550, y: 272 } },
          { type: 'waitForText', text: 'SNP/Mismatch' },
          { type: 'delay', ms: 300 },
          { type: 'hover', text: 'SNP/Mismatch' },
          { type: 'waitForText', text: 'Sort by base at position' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Sort by base at position' } },
        ],
      },
      {
        actions: [
          // actually perform the sort by clicking the boxed menu item so the
          // bottom frame teaches cause→effect (and isn't a stale preset that
          // restored unsorted); the click closes the menu
          { type: 'click', text: 'Sort by base at position' },
          {
            type: 'waitForText',
            text: 'Sort by base at position',
            hidden: true,
          },
          // move the pointer off the pileup so no hover tooltip lingers, then
          // let the re-sort settle and repaint
          { type: 'hover', from: { x: 200, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // B2M (plus strand, chr15) — a ubiquitously-expressed housekeeping gene
          // with a single isoform and just 3 introns, so the RNA-seq sashimi arcs
          // are few and clean (GAPDH's many short exons gave "tons of small arcs").
          loc: 'chr15:45,003,000-45,012,000',
          tracks: [
            {
              trackId: 'ncbi_gff_hg19',
              // give the gene track room so the B2M model is clearly visible
              // above the sashimi arcs (reviewer: gene track too short to see)
              displaySnapshot: { type: 'LinearBasicDisplay', height: 120 },
            },
            'Pairend_StrandSpecific_51mer_Human_hg19',
          ],
        },
      ],
    }),
    readyText: 'B2M',
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
          loc: 'chr8:50,366,343-61,321,733',
          tracks: [
            {
              trackId: 'ncbi_gff_hg19',
              // hide gene descriptions so the gene track stays compact next to
              // the Hi-C display (reviewer request)
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                showDescriptions: false,
              },
            },
            'hic',
          ],
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

  // CRAM modifications + bedmethyl together: a wider ~5kb window (reviewer: zoom
  // out) so the COLO829 nanopore reads' per-base CpG methylation calls (colorBy
  // methylation) line up with the modkit bedmethyl summary track. The bedmethyl
  // MultiQuantitativeTrack is forced to a 0-100 domain since modkit outputs
  // methylation as a percentage (reviewer), with a slightly shorter track.
  {
    mode: 'url',
    name: 'methylation/colo829_cram_and_bedmethyl',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:9,998,000-10,003,000',
          tracks: [
            {
              trackId: 'COLO829_tumor.ht_modkit.bed_multi',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                minScore: 0,
                maxScore: 100,
                height: 150,
              },
            },
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
    settleMs: 35000,
  },

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

  // Before/after horizontal flip, stacked into one figure: top frame is the
  // normal orientation, bottom frame after the view-menu "Horizontally flip"
  // (reverse complement) — the gene arrows and overview triangles reverse
  // direction. Rebuilt from the old server-side share link as a self-contained
  // sessionSpec over the hg19 ACTB locus (single longest-coding transcript so the
  // strand arrow reads clearly).
  {
    mode: 'url',
    name: 'horizontally_flip',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr7:5,562,000-5,575,000',
          tracks: [
            {
              trackId: 'ncbi_gff_hg19',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 8000,
    // trim the empty viewport below the single track
    crop: { x: 0, y: 0, width: 1500, height: 300 },
    stages: [
      {
        // top frame: normal orientation, with the view-menu icon ringed and a
        // callout telling the reader to select "Horizontally flip" from it
        actions: [{ type: 'delay', ms: 500 }],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          {
            type: 'text',
            text: 'Select "Horizontally flip"',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
            dx: 40,
            dy: 0,
            background: 'rgba(0,0,0,0.78)',
            textColor: '#fff',
          },
        ],
      },
      {
        // bottom frame: after the view-menu "Horizontally flip" the gene arrows /
        // overview triangles reverse direction. The menu auto-closes on click so
        // it never appears in the result frame.
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          { type: 'waitForText', text: 'Horizontally flip' },
          { type: 'click', text: 'Horizontally flip' },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // Whole-genome CNV: COLO829 melanoma tumor vs matched normal coverage as a
  // single multi-quantitative bigWig track, shown at chromosome scale (no `loc`
  // → showAllRegionsInAssembly) with localsd ±3sd autoscale so copy-number
  // gains/losses stand out. The two sources use the default multiwiggle palette
  // (no explicit per-source colors). Rebuilt from the old server-side share link
  // as a self-contained sessionSpec/MultiWiggleAdapter over the two COLO829
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
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                source: 'COLO829 normal',
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
                defaultRendering: 'multiscatter',
                // even finer binning (basesPerSpan = bpPerPx/resolution) so the
                // scatter resolves copy-number structure (reviewer: even finer)
                resolution: 10,
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

  // The 27bp heterozygous deletion in HG002 ONT reads at ~1:63,006,xxx (hg19),
  // rebuilt from a share link as a self-contained sessionSpec so the figure
  // renders headless without the force-load prompt. The HG002 GIAB consensus SV
  // VCF (the DEL call) sits on top; the ultralong-ONT BAM below is colored +
  // sorted by HP tag so the two haplotypes separate (the deletion concentrates
  // in one). userByteSizeLimit lifts the force-load byte gate so the reads
  // auto-load instead of sitting on "Loading"; readySelector waits for the
  // pileup canvas to actually paint before capture (reviewer: wait for tracks
  // ready, no "Loading").
  {
    mode: 'url',
    name: 'smalldel',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,675-63,007,432',
          tracks: [
            'variants_hg002',
            {
              trackId: 'hg002_nanopore',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                height: 450,
                userByteSizeLimit: 200_000_000,
                colorBy: { type: 'tag', tag: 'HP' },
                sortedBy: {
                  type: 'tag',
                  tag: 'HP',
                  pos: 63006550,
                  refName: '1',
                  assemblyName: 'hg19',
                },
              },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 1000,
    settleMs: 15000,
  },

  // The nssv15767046 insertion at ~1:55,705,920 (hg19) shown across HG002
  // nanopore (top), PacBio (middle), and Illumina (bottom) read tracks under the
  // HG002 dbVar variant call. Reconstructed from DEMO_CONFIG (was a share-link
  // that opened with the track selector covering the panel) so the sessionSpec
  // form opens with the selector closed. The high-depth PacBio Sequel track is
  // capped to a fixed height and the window is taller, so its deep coverage no
  // longer pushes the Illumina reads out of frame.
  {
    mode: 'url',
    name: 'insertion',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        // A region-slice of the HG002 PacBio Sequel 15kb BAM (1:55.70-55.71Mb,
        // 70 reads, 650KB) rehosted on jbrowse.org/demos/hg002 so the PacBio reads
        // load reliably — the full remote NCBI BAM intermittently errored here.
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_pacbio_chr1_insertion_slice',
          name: 'HG002 PacBio Sequel 15kb (chr1 slice)',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam.bai',
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
          assembly: 'hg19',
          loc: '1:55,705,770-55,706,090',
          tracks: [
            'nstd175.GRCh37.variant_call.vcf',
            { trackId: 'hg002_nanopore', displaySnapshot: { height: 200 } },
            {
              trackId: 'hg002_pacbio_chr1_insertion_slice',
              displaySnapshot: { height: 200 },
            },
            {
              trackId: 'illumina_hg002',
              // show soft clipping so the clipped bases flanking the insertion
              // are visible on the Illumina reads (reviewer)
              displaySnapshot: { height: 250, showSoftClipping: true },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    viewportHeight: 1000,
    settleMs: 20000,
  },

  // Multi-sample variant display on the 1000 Genomes phase-3 SV ensemble callset
  // (3202 samples) across chr19:42.7-47.8Mb, sorted by genotype at the large
  // ~1.12Mb inversion HGSV_73318 (chr19:46,275,880-47,396,219, AF=0.238). Because
  // this display draws variants at genomic position, the inversion renders as a
  // wide band; after the sort, carrier samples cluster to the top so the band
  // splits cleanly. Rebuilt from a share link as a declarative sessionSpec. The
  // right-click lands at x~1130 (genomic ~46.55Mb), an inversion-only gap where no
  // other SV overlaps, so the sort reliably targets the inversion. userByteSizeLimit
  // lifts the 1MB tabix fetch gate so the 5Mb window auto-loads headless instead of
  // showing a force-load prompt. Remote 1000genomes data, so allow a long ready/settle.
  {
    mode: 'url',
    name: 'multisv',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '19:42,749,096-47,802,386',
          tracks: [
            {
              trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
              displaySnapshot: {
                type: 'LinearMultiSampleVariantDisplay',
                userByteSizeLimit: 100_000_000,
                // shorter multi-sample display (reviewer: ~400px)
                height: 400,
              },
            },
            // NCBI RefSeq gene track below the variant display (reviewer)
            {
              trackId: 'ncbi_refseq_109_hg38',
              displaySnapshot: { height: 140 },
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    viewportHeight: 720,
    settleMs: 35000,
    hideTooltip: true,
    actions: [
      // y=450 lands in the multi-sample matrix (proven coordinate); the dense
      // 5Mb gene track never fully clears "Loading" headless, so don't gate on it
      { type: 'rightclick', from: { x: 1130, y: 450 } },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Sort by genotype' },
      { type: 'delay', ms: 6000 },
      // move the pointer off the matrix so the mouseover crosshair doesn't bake
      // into the capture (reviewer: remove the crosshairs)
      { type: 'hover', from: { x: 6, y: 6 } },
      { type: 'delay', ms: 800 },
    ],
  },

  // Trio SV: the Kinh-Vietnamese trio (HG02030 child / HG02031 mother / HG02032
  // father) Illumina reads stacked over the 1000 Genomes Illumina ensemble SV
  // callset, at a ~43kb SV locus. Reads auto-load via a raised userByteSizeLimit;
  // per-track heights capped so all four tracks fit one viewport.
  {
    mode: 'url',
    name: 'multi-sv-trio',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:40,481,472-40,524,349',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02030.final',
              displaySnapshot: { height: 180, userByteSizeLimit: 200_000_000 },
            },
            {
              trackId: 'HG02031.final',
              displaySnapshot: { height: 180, userByteSizeLimit: 200_000_000 },
            },
            {
              trackId: 'HG02032.final',
              displaySnapshot: { height: 180, userByteSizeLimit: 200_000_000 },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02030',
    readyTimeout: 90000,
    viewportHeight: 900,
    settleMs: 25000,
  },

  // sv_visualization.md: the TRA feature-details panel with its "Launch split
  // views with breakend source and target" link. Zoomed onto a single SKBR3
  // Sniffles translocation breakend (14:84871468 // 17:74803924) so clicking
  // the lone variant opens the details drawer; the BREAKENDS link is annotated.
  {
    mode: 'url',
    name: 'link_to_split_view',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '14:84,871,462-84,871,480',
          tracks: ['breast_cancer_sniffles_hg19_traonly_tabix'],
        },
      ],
    }),
    readyText: '84,871',
    settleMs: 5000,
    // tall viewport so the full-height feature-details panel shows the
    // LaunchBreakendPanel link below the long TRA INFO table
    viewportHeight: 1100,
    actions: [
      // click the TRA variant's floating feature label (stable per-feature
      // testid) to open the feature-details drawer; the translocation's
      // INFO.CHR2/END drive the LaunchBreakendPanel split-view link
      { type: 'click', selector: '[data-testid="feature-name-89844_3"]' },
      { type: 'waitForText', text: 'breakpoint split view' },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      { type: 'box', anchor: { text: 'breakpoint split view' } },
      // arrow + explanatory callout pointing at the boxed split-view link
      {
        type: 'arrow',
        from: { x: 760, y: 300 },
        anchor: { text: 'breakpoint split view' },
      },
      {
        type: 'text',
        x: 60,
        y: 270,
        text: 'Automatically launches a breakpoint split view for the TRA SV',
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
      },
      {
        type: 'text',
        x: 60,
        y: 300,
        text: 'Paired-end and long reads also have this in their feature details',
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
      },
    ],
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

  // Inverted duplication (CPX/INVdup HGSV_2721) on real 1000-genomes data: the
  // HG02768 CRAM with linkedReads (mates drawn connected on one row) plus arc
  // read-connections and pair-orientation coloring makes the overlapping
  // inversion / tandem-dup pairing pattern visible, alongside the 1KGP ensemble
  // VCF call.
  // loc shifted ~600bp right so HGSV_2721 (near right of original range) sits
  // centered in the panel-narrowed view after the feature sidebar opens.
  // Single view at the inverted-duplication locus: orientation-colored read pairs
  // with the connecting arcs pointing upwards and a tall coverage track, with the
  // HGSV_2721 variant feature details opened.
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
                readConnectionsDown: false,
                height: 900,
                coverageHeight: 120,
                colorBy: { type: 'pairOrientation' },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // taller window so more of the pileup + the feature-details sidebar fit
    // (reviewer request)
    viewportHeight: 1300,
    settleMs: 30000,
    // click the HGSV_2721 variant's floating feature label (stable per-feature
    // testid) to open its feature details
    actions: [
      {
        type: 'click',
        selector: '[data-testid="feature-name-HGSV_2721"]',
      },
      { type: 'delay', ms: 4000 },
    ],
    // ring the CPX_TYPE INFO field in the variant feature-details sidebar
    annotations: [{ type: 'circle', anchor: { text: 'CPX_TYPE' } }],
  },

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  // Three-stage SV-inspector launch figure: (1) the app "Add" menu with the "SV
  // inspector" item boxed; (2) the import form that item opens; (3) the somatic
  // SV VCF URL pasted into the import form's URL box (reviewer asked to also show
  // pasting a file into the URL box). Replaces the old single-frame
  // sv_inspector_begin (menu launch) and sv_inspector_importform (import form).
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    // crop off the empty viewport below the menu / import form in each frame
    crop: { x: 0, y: 0, width: 1500, height: 460 },
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add' },
          { type: 'waitForText', text: 'SV inspector' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'SV inspector' } }],
      },
      {
        actions: [
          { type: 'click', text: 'SV inspector' },
          { type: 'waitForText', text: 'Open file from URL or local computer' },
          { type: 'delay', ms: 2000 },
        ],
      },
      {
        actions: [
          {
            type: 'type',
            selector: '[data-testid="urlInput"]',
            value:
              'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
          },
          { type: 'delay', ms: 800 },
        ],
        annotations: [
          { type: 'box', anchor: { selector: '[data-testid="urlInput"]' } },
          {
            type: 'text',
            x: 60,
            y: 120,
            text: 'Paste a file URL (here, the somatic SV VCF) and open it',
            background: 'rgba(0,0,0,0.78)',
            textColor: '#fff',
          },
        ],
      },
    ],
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
    // the import form is short; crop off the empty viewport below it, but
    // keep enough height to show the form's helper text in full
    crop: { x: 0, y: 0, width: 1500, height: 230 },
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: cgiabUrl({
      sessionTracks: [
        // hg38 NCBI RefSeq genes served from the jbrowse.org/ucsc hub (chr-named,
        // CSI-indexed) — matches the GRCh38_GIABv3 chr refnames directly, so no
        // rehosting needed.
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
        // A small region-slice of the 116x tumor PacBio BAM (chr10:122.8-122.87Mb,
        // ~360 reads, 2.8MB) rehosted on jbrowse.org/demos/cgiab so the reads
        // auto-load fast instead of tripping the force-load guard the full 116x
        // BAM hits over this 28kb window (reviewer: render the reads).
        {
          type: 'AlignmentsTrack',
          trackId: 'hg008t_pacbio_chr10_deletion_slice',
          name: 'HG008-T PacBio HiFi (116x, chr10 slice)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam.bai',
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
          loc: 'chr10:122,822,042-122,850,825',
          // The somatic SV VCF's SV_85 <DEL> call marks the deletion against the
          // NCBI RefSeq gene context (CUZD1), with the rehosted PacBio read slice
          // showing the supporting reads across the deletion.
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
            {
              trackId: 'hg008t_pacbio_chr10_deletion_slice',
              displaySnapshot: { height: 300 },
            },
          ],
        },
      ],
    }),
    readyText: 'chr10',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    // Whole chr5 with BOTH tumor and normal coverage as separate scatter bigwigs
    // (reviewer) above the somatic CNV benchmark bed calls, so the coverage
    // gains/losses can be compared against the called intervals. Uses the
    // normalized indexcov bigwigs (median≈1 → reads directly as copy number).
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_normal_indexcov',
          name: 'HG008-N (normal) coverage',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-N_indexcov.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_tumor_indexcov',
          name: 'HG008-T (tumor) coverage',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_indexcov.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5',
          tracks: [
            {
              trackId: 'hg008_normal_indexcov',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                autoscale: 'localsd',
              },
            },
            {
              trackId: 'hg008_tumor_indexcov',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                autoscale: 'localsd',
              },
            },
            'GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    // wider viewport so the whole-chromosome CNV + bed track aren't cut off
    viewportWidth: 1800,
    settleMs: 15000,
  },

  // Whole-genome normal-vs-tumor coverage as a MultiQuantitativeTrack, from
  // indexcov-estimated coverage bigWigs (computed in seconds from the BAM .bai
  // indexes, normalized so median≈1 → reads directly as copy number) hosted at
  // jbrowse.org/demos/cgiab. All 24 chromosomes via a multi-region locstring
  // (showAllRegions races the giant remote assembly load, so name them).
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_multi_bigwig',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'hg008_cnv_indexcov',
          name: 'HG008 normal vs tumor coverage (indexcov)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                name: 'HG008-N (normal)',
                type: 'BigWigAdapter',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/demos/cgiab/HG008-N_indexcov.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                name: 'HG008-T (tumor)',
                type: 'BigWigAdapter',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/demos/cgiab/HG008-T_indexcov.bw',
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
          assembly: 'GRCh38_GIABv3',
          loc: 'chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chr22 chrX chrY',
          tracks: [
            {
              trackId: 'hg008_cnv_indexcov',
              displaySnapshot: { height: 200 },
            },
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    viewportWidth: 1800,
    settleMs: 25000,
  },

  // Same whole-genome multi-bigwig with a manual max-score cap so a few
  // high-coverage spikes (centromeres/repeats) don't compress the copy-number
  // band — the normalized indexcov domain runs ~0-2, so cap at 2.5.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_score_limit',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'hg008_cnv_indexcov',
          name: 'HG008 normal vs tumor coverage (indexcov)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                name: 'HG008-N (normal)',
                type: 'BigWigAdapter',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/demos/cgiab/HG008-N_indexcov.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                name: 'HG008-T (tumor)',
                type: 'BigWigAdapter',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/demos/cgiab/HG008-T_indexcov.bw',
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
          assembly: 'GRCh38_GIABv3',
          loc: 'chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chr22 chrX chrY',
          tracks: [
            {
              trackId: 'hg008_cnv_indexcov',
              displaySnapshot: { height: 200, minScore: 0, maxScore: 2.5 },
            },
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    viewportWidth: 1800,
    settleMs: 25000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_result',
    // The cgiab config ships this synteny track with a plain PAFAdapter pointed
    // at a .pif.gz — but PAFAdapter doesn't strip the PIF q/t refName prefixes,
    // so every feature's refName ("qhaplotype1-…") fails to match the assembly
    // refName ("haplotype1-…") and the dotplot renders empty. Override the track
    // with the correct PairwiseIndexedPAFAdapter (tabix .pif.gz) so the dots paint.
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'HG008T.hap1_pif',
          name: 'HG008T.hap1',
          assemblyNames: ['HG008T.hap1', 'GRCh38_GIABv3'],
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            assemblyNames: ['HG008T.hap1', 'GRCh38_GIABv3'],
            pifGzLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: 'https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz.tbi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'HG008T.hap1' }, { assembly: 'GRCh38_GIABv3' }],
          tracks: ['HG008T.hap1_pif'],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    viewportWidth: 1800,
    // canvasDrawn doesn't reliably flip for this whole-genome WebGL dotplot, so
    // gate on the grid labels then settle long for the heavy whole-genome PIF
    // fetch to paint its dots
    settleMs: 60000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/synteny_view',
    // Same fix as sv_cgiab/dotplot_result: the config's plain PAFAdapter can't
    // strip the PIF q/t refName prefixes, so ribbons never map. Override with
    // PairwiseIndexedPAFAdapter. hap1 contigs 16 (↔chr3, ↔chr13) and 11 (↔chr13)
    // are the ones that actually align to the displayed GRCh38 chromosomes, so
    // the ribbons connect (contig 15 maps to chr1/chr5, not shown here).
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'HG008T.hap1_pif',
          name: 'HG008T.hap1',
          assemblyNames: ['HG008T.hap1', 'GRCh38_GIABv3'],
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            assemblyNames: ['HG008T.hap1', 'GRCh38_GIABv3'],
            pifGzLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'TBI',
              location: {
                uri: 'https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz.tbi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['HG008T.hap1_pif'],
          // curved ribbons + a taller synteny band so the connections read
          // clearly (reviewer)
          drawCurves: true,
          levelHeights: [400],
          views: [
            {
              loc: 'chr3:1-198295559 chr13:1-114364328',
              assembly: 'GRCh38_GIABv3',
            },
            {
              loc: 'haplotype1-0000016:1-212902875 haplotype1-0000011:1-99479325',
              assembly: 'HG008T.hap1',
            },
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1800,
    // fit the synteny band + both panels without a tall white margin
    viewportHeight: 470,
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
    // arrows point at the select boxes themselves (anchored to the helper label
    // below each, nudged up onto the dropdown), with callouts on dark pills
    annotations: [
      {
        type: 'text',
        x: 120,
        y: 110,
        text: 'Select the query (x-axis) assembly',
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
        fontSize: 15,
      },
      {
        type: 'arrow',
        from: { x: 300, y: 128 },
        anchor: { text: 'x-axis assembly' },
        dy: -44,
      },
      {
        type: 'text',
        x: 950,
        y: 110,
        text: 'Select the target (y-axis) assembly',
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
        fontSize: 15,
      },
      {
        type: 'arrow',
        from: { x: 1130, y: 128 },
        anchor: { text: 'y-axis assembly' },
        dy: -44,
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
  // Gene feature-details sequence panel: click the multi-exon volvox EDEN gene to
  // open its details, expand "Show feature sequence", and switch the type selector
  // to the genomic-with-introns + up/down-stream mode so the panel shows the
  // colored upstream / exon / intron / downstream sequence.
  //
  // NOTE: the reviewer asked for a human FAF1 example on config_demo. That is
  // blocked headless — the demo human gene tracks (RefSeq `ncbi_gff_hg19` and
  // Gencode GFF) don't expose the "Genomic w/ full introns" option in the
  // sequence panel (only plain "Genomic +/- Nbp"), because the clicked gene
  // feature's CDS subfeatures aren't recognized; the Gencode track also labels by
  // Ensembl ID, not "FAF1". See SCREENSHOT_REVIEW_HANDOFF.md §feature_detail_sequence.
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
            { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      // Must click a transcript glyph, not the gene: the gene-level sequence
      // panel is only a container for its transcripts and offers no
      // full-introns/CDS option. Transcript glyphs are canvas-drawn with no DOM
      // text label (only the gene gets a clickable `feature-name-EDEN` div), so a
      // coordinate click on the transcript row is required here — a text click
      // can only reach the gene label. (x,y lands on the EDEN.1 transcript.)
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Genomic w/ full introns +/-' },
      { type: 'delay', ms: 3000 },
    ],
  },
  {
    mode: 'url',
    name: 'methylation/arabidopsis_chh',
    // ONT 5mC/5hmC per-read modifications (MM/ML), colored by methylation.
    // Must stay within the 50kb local reference (NC_003070.9 is only 50kb here)
    // so the cytosine context can be resolved. 16-18kb is a heavily CHH-methylated
    // RdDM/TE region (~38% CHH by EM-seq, vs ~5% genome-wide), so methylated sites
    // actually render — the old "only blue" was the colorBySetting field bug, not
    // the region.
    url: sessionSpec('test_data/arabidopsis_methylation/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'arabidopsis',
          loc: 'NC_003070.9:16,000-18,000',
          tracks: [
            {
              trackId: 'arabidopsis_meth',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                colorBy: {
                  type: 'methylation',
                  modifications: { cytosineContext: 'CHH' },
                },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'NC_003070',
    readyTimeout: 60000,
    settleMs: 12000,
  },
  {
    mode: 'url',
    name: 'methylation/arabidopsis_bisulfite_chh',
    // The local reference NC_003070.9 is only 50kb, so the region must stay
    // within it for bisulfite to resolve cytosine context (the old 144kb loc was
    // beyond the reference -> no context -> only blue). A C-retention scan of the
    // EM-seq reads ranked 16-18kb highest (~38% mean CHH methylation, an
    // RdDM/TE-rich patch), so navigate there to show actually-methylated CHH.
    url: sessionSpec(
      'test_data/arabidopsis_methylation/config_emseq_bisulfite.json',
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'arabidopsis',
            loc: 'NC_003070.9:16,000-18,000',
            tracks: [
              {
                trackId: 'arabidopsis_emseq',
                displaySnapshot: {
                  type: 'LinearAlignmentsDisplay',
                  colorBy: {
                    type: 'bisulfite',
                    modifications: { cytosineContext: 'CHH' },
                  },
                },
              },
            ],
          },
        ],
      },
    ),
    readyText: 'NC_003070',
    readyTimeout: 60000,
    settleMs: 14000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Basic UI guides
  // ────────────────────────────────────────────────────────────────────────

  // LGV usage guide: text-label callouts anchored to the live toolbar controls
  // (so positions track the UI, no hand-tuned coords), each on a dark pill so
  // the reader doesn't have to cross-reference a numbered legend. Labels are
  // staggered vertically so same-row controls don't overlap.
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
      {
        type: 'text',
        text: 'Add view',
        anchor: { text: 'Add' },
        dx: -10,
        dy: 26,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
      },
      {
        type: 'text',
        text: 'Pan',
        anchor: { selector: 'button[aria-label="Pan left"]' },
        dx: -10,
        dy: 50,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
      },
      {
        type: 'text',
        text: 'Zoom',
        anchor: { selector: '[data-testid="zoom_in"]' },
        dx: -12,
        dy: 26,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
      },
      {
        type: 'text',
        text: 'Search box',
        anchor: { selector: 'input[placeholder="Search for location"]' },
        dx: -30,
        dy: 50,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
      },
      {
        type: 'text',
        text: 'Scroll-to-zoom toggle',
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
        dx: -60,
        dy: 26,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
      },
      {
        type: 'text',
        text: 'Drag to reorder track',
        anchor: { selector: '[data-testid^="dragHandle-"]' },
        dx: 4,
        dy: 24,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
      },
      {
        type: 'text',
        text: 'Track menu',
        anchor: { selector: '[data-testid="track_menu_icon"]' },
        dx: -30,
        dy: 24,
        fontSize: 14,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
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
    viewportHeight: 600,
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
        // ring the AddTrackWidget drawer that opened in the sidebar
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="drawer-widget"]' },
          },
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
        dy: 36,
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
      },
      {
        type: 'box',
        anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
      },
      {
        type: 'text',
        text: 'Add track',
        anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
        dx: -110,
        dy: 4,
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
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

  // Track label positioning submenu in the view menu, over config_demo's hg19
  // gene + HG002 Illumina BAM tracks. The view menu (hamburger) icon is ringed
  // so the reader can see where the menu was opened from.
  {
    mode: 'url',
    name: 'tracklabels',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:55,704,500-55,707,500',
          tracks: ['ncbi_gff_hg19', 'illumina_hg002'],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    settleMs: 12000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Track labels' },
      { type: 'delay', ms: 300 },
      { type: 'hover', text: 'Track labels' },
      { type: 'waitForText', text: 'Overlapping' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="view_menu_icon"]' },
      },
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

  // Drawer widget position, two-stage figure. Top frame opens the drawer's
  // position menu (MoreVert in the drawer header) with the menu trigger ringed
  // and the "left" option boxed; bottom frame clicks "left" so the drawer moves
  // to the left side of the screen.
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
    // smaller capture window in both dimensions (reviewer request)
    viewportWidth: 1150,
    viewportHeight: 560,
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
    ],
    stages: [
      {
        actions: [
          // click the MoreVert to open the position menu
          { type: 'click', selector: '[data-testid="drawer-position-button"]' },
          { type: 'waitForText', text: 'left' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="drawer-position-button"]' },
          },
          { type: 'box', anchor: { text: 'left' } },
          // arrow drawing the eye from the ringed position button down to the
          // boxed "left" option (reviewer: add an arrow to the annotation)
          {
            type: 'arrow',
            from: { x: 560, y: 230 },
            anchor: { text: 'left' },
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'left' },
          { type: 'delay', ms: 1500 },
        ],
      },
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

  // Bookmark create, two-stage figure: top frame is the rubberband context menu
  // with "Bookmark region" boxed; bottom frame clicks it so the bookmarked
  // region appears as a colored highlight across the view. Uses config_demo hg19
  // over the PTEN gene (reviewer request) with a shorter viewport.
  {
    mode: 'url',
    name: 'bookmark_widget_create',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr10:89,613,000-89,740,000',
          tracks: ['ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    viewportHeight: 560,
    settleMs: 10000,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Bookmark region' },
      { type: 'delay', ms: 500 },
    ],
    stages: [
      {
        annotations: [{ type: 'box', anchor: { text: 'Bookmark region' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Bookmark region' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  // Bookmark widget with a bookmark label showing a highlight on the LGV, over
  // config_demo's hg19. Shorter viewport keeps the figure tight.
  {
    mode: 'url',
    name: 'bookmark_widget_edit_label',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:1-20,000',
          tracks: ['ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 10000,
    viewportHeight: 520,
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
      { type: 'waitForText', text: 'Add label...' },
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
          loc: 'chr1:161,172,613-161,181,745',
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
  // discordant pairs make the arcs meaningful). Top frame: the track menu's "Read
  // connections → Show pair overlay" radio submenu with "Arcs" boxed, drawn over
  // a plain pileup (no arcs yet). Bottom frame: "Arcs" selected, so the arcs
  // render. Cropped to drop the empty viewport below the short track.
  {
    mode: 'url',
    name: 'alignments/select_arc_display',
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
    // shorter viewport (rather than a crop) so the result frame isn't mostly
    // whitespace while still leaving room for the deep "Read connections" submenu
    viewportHeight: 600,
    settleMs: 5000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Read connections' },
          { type: 'delay', ms: 300 },
          { type: 'hover', text: 'Read connections' },
          { type: 'waitForText', text: 'Show read arcs' },
          { type: 'delay', ms: 600 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Show read arcs' } },
          { type: 'box', anchor: { text: 'Show read cloud' } },
        ],
      },
      {
        // tick the "Show read arcs" checkbox so the result frame shows arcs
        actions: [
          { type: 'click', text: 'Show read arcs' },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // COLO829 tumor nanopore reads colored by base modification (5mC/5hmC) across a
  // UCSC CpG island on chr20 (reviewer: use COLO829_tumor.ht at a CpG island + add
  // a CpG island track). Declarative `colorBy: {type:'modifications'}` — the same
  // state the track menu's Color by → Base modifications → All modification types
  // applies — because driving that 3-level hover menu live is unreliable over the
  // COLO829 GPU display (its mod-data load keeps repainting the canvas, which
  // closes the MUI menu mid-cascade). userByteSizeLimit auto-loads the reads.
  {
    mode: 'url',
    name: 'alignments/modifications1',
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
                colorBy: { type: 'modifications' },
                userByteSizeLimit: 100_000_000,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 35000,
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
    annotations: [
      { type: 'box', anchor: { text: 'Collapse top-level categories' } },
      { type: 'box', anchor: { text: 'Collapse subcategories' } },
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
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:1-100,000',
        },
      ],
    }),
    // hg19 displays the refname as "1" (no chr prefix); wait for the menubar
    // instead of a chr label since this view starts with no tracks
    readyText: 'Open track selector',
    readyTimeout: 60000,
    // smaller window keeps the focus on the track-list + recently-used dropdown
    viewportWidth: 1100,
    viewportHeight: 650,
    settleMs: 8000,
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
      // filter the (virtualized) list so the target row is rendered, then open
      // it through the UI (by name) so it lands in "recently used"
      { type: 'type', text: 'Filter tracks', value: 'NCBI RefSeq' },
      { type: 'delay', ms: 800 },
      { type: 'click', text: 'NCBI RefSeq w/ subfeature details' },
      // wait for the just-opened track to finish loading so the first frame
      // isn't captured mid-"Loading" (reviewer)
      { type: 'waitForText', text: 'Loading', hidden: true },
      { type: 'delay', ms: 1500 },
      // clear the filter (target the actual input, not the floating label, so
      // select-all + Backspace empties it) so the tracklist behind the dropdown
      // isn't showing distracting search text (reviewer)
      {
        type: 'type',
        selector: '[data-testid="hierarchical_track_selector"] input',
        value: '',
        clear: true,
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
          { type: 'waitForText', text: 'NCBI RefSeq w/ subfeature details' },
          { type: 'delay', ms: 500 },
        ],
      },
    ],
  },

  // Favorite tracks: two-stage figure. Top frame boxes the per-track menu's
  // "Add to favorites" item; bottom frame opens the resulting Favorites dropdown
  // with a ring around the Favorites (star) button.
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
    viewportHeight: 650,
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
        annotations: [{ type: 'box', anchor: { text: 'Add to favorites' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Add to favorites' },
          { type: 'delay', ms: 500 },
          { type: 'click', selector: '[data-testid="favorite-tracks-button"]' },
          { type: 'waitForText', text: 'GFF3Tabix genes' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="favorite-tracks-button"]' },
          },
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

  // MultiWig color/arrangement preset over the ENCODE multi-bigWig demo track
  // (microarray_multi, 21 ENCODE bigWigs) from config_demo.json. The display
  // `layout` is the TreeSidebarMixin frozen Source[] of {name,color} overrides
  // (see packages/tree-sidebar/src/TreeSidebarMixin.ts; source names are the
  // ENCFF* bigWig filenames, MultiWiggleAdapter.getFilename). Here it presets
  // the first 3 sources red, the next 10 green, and the remaining 8 blue. Two
  // stacked frames: the color/arrangement editor showing the per-source
  // swatches, then the resulting red/green/blue-colored multi-wiggle track.
  {
    mode: 'url',
    name: 'multiwig/multi_colorselect',
    // Uses the local volvox MultiWiggle (sources k1-k4) rather than the
    // config_demo ENCODE microarray_multi: ENCODE's bigWigs 403 to the headless
    // browser. The figure's point is the per-source color/arrangement editor, so
    // any multi-source wiggle works — preset k1 red, k2/k3 green, k4 blue.
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
                height: 400,
                layout: [
                  { name: 'k1', color: 'red' },
                  { name: 'k2', color: 'green' },
                  { name: 'k3', color: 'green' },
                  { name: 'k4', color: 'blue' },
                ],
              },
            },
          ],
        },
      ],
    }),
    readyText: 'MultiWig',
    readyTimeout: 90000,
    settleMs: 12000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Edit colors/arrangement...' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Edit colors/arrangement...' },
          {
            type: 'waitForText',
            text: 'Multi-wiggle color/arrangement editor',
          },
          { type: 'delay', ms: 1500 },
        ],
      },
      {
        closeMenusFirst: true,
        actions: [{ type: 'delay', ms: 2000 }],
      },
    ],
  },

  // multiquantitative_track.md: the track-selector selection workflow for
  // building a multi-wiggle. Two stacked frames: (1) a category's "..." menu
  // with "Add to selection" boxed, (2) after adding the category, the shopping
  // cart's "Create multi-wiggle track" item boxed.
  {
    mode: 'url',
    name: 'multiwig/trackselector',
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
    // shorter viewport (reviewer: the old 1600px figure was way too tall); the
    // "Integration test" wiggle category still renders within this height
    viewportHeight: 760,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          { type: 'waitForText', text: 'Open track selector' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Open track selector' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          { type: 'delay', ms: 500 },
          // open the category's "..." menu (stable testid on the category
          // CascadingMenuButton)
          {
            type: 'click',
            selector: '[data-testid="htsCategoryMenu-Integration test"]',
          },
          { type: 'waitForText', text: 'Add to selection' },
          { type: 'delay', ms: 400 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Add to selection' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Add to selection' },
          { type: 'delay', ms: 600 },
          // the shopping cart appears once the selection is non-empty
          { type: 'click', selector: '[data-testid="hts-shopping-cart"]' },
          { type: 'waitForText', text: 'Create multi-wiggle track' },
          { type: 'delay', ms: 400 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Create multi-wiggle track' } },
        ],
      },
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
    ],
    // two-stage: top frame opens the workflow-selector dropdown with a callout
    // (on a dark pill so it reads over the form) and an arrow to it; bottom frame
    // selects "Add multi-wiggle track" so the multi-wiggle entry form shows
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add a track from file or URL' },
          { type: 'waitForText', text: 'Add multi-wiggle track' },
          { type: 'delay', ms: 800 },
        ],
        annotations: [
          {
            type: 'text',
            x: 470,
            y: 150,
            text: 'Use this dropdown to reach alternative add-track workflows, e.g. multi-wiggle',
            background: 'rgba(0,0,0,0.8)',
            textColor: '#fff',
            fontSize: 15,
          },
          {
            type: 'arrow',
            from: { x: 880, y: 162 },
            anchor: { selector: '[aria-expanded="true"]' },
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add multi-wiggle track' },
          { type: 'waitForText', text: 'Add' },
          { type: 'delay', ms: 1200 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // GWAS / Manhattan plot
  // ────────────────────────────────────────────────────────────────────────

  // Manhattan plot from a real human GWAS (config_gwas hg19 genome-wide summary
  // stats) over a whole chromosome (chr2), so the classic dense field of points
  // with significant peaks reads as a per-chromosome Manhattan overview (reviewer:
  // show a whole-chromosome overview). The binned Manhattan display renders the
  // full contig fast enough headless even though genome-wide showAllRegions did
  // not.
  {
    mode: 'url',
    name: 'gwas/manhattan',
    url: sessionSpec('test_data/config_gwas.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '2',
          tracks: [
            {
              trackId: 'gwas_track',
              displaySnapshot: { type: 'LinearManhattanDisplay', height: 250 },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 470,
    settleMs: 12000,
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
              displaySnapshot: { type: 'LinearManhattanDisplay', height: 250 },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 60000,
    viewportHeight: 350,
    // settle past the index auto-pick + recolor fetch that follows first paint
    settleMs: 12000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Plugin store
  // ────────────────────────────────────────────────────────────────────────

  // Plugin store, single frame: the plugin-store drawer widget open on the right
  // AND the Tools menu reopened over the view, with the "Plugin store" menu item
  // ringed and an arrow pointing across to the open widget sidebar (reviewer:
  // collapse the old two-stage figure into one that shows the menu path and the
  // result together). The ring anchors to the menu item (smaller text area than
  // the widget's h5 heading, so the smallest-area anchor heuristic picks it).
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
      { type: 'delay', ms: 400 },
      // open the widget (this closes the Tools menu)
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Installed plugins' },
      { type: 'delay', ms: 1500 },
      // reopen the Tools menu so the menu path and the open widget show together
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
      { type: 'delay', ms: 600 },
    ],
    annotations: [
      { type: 'circle', anchor: { text: 'Plugin store' } },
      {
        type: 'arrow',
        from: { x: 300, y: 250 },
        anchor: { text: 'Installed plugins' },
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Dotplot / synteny interactions
  // ────────────────────────────────────────────────────────────────────────

  // Dotplot launch, two-stage figure: top frame opens the app "Add" menu with
  // "Dotplot view" boxed; bottom frame is the import form it opens (launched
  // from an empty session so only the import form shows, no leftover LGV).
  // Replaces the old separate dotplot_menu screenshot. Narrow window + height
  // crop keep the figure tight on the menu and form.
  {
    mode: 'url',
    name: 'dotplot_add',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    viewportWidth: 900,
    settleMs: 2000,
    crop: { x: 0, y: 0, width: 900, height: 540 },
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add' },
          { type: 'waitForText', text: 'Dotplot view' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Dotplot view' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Dotplot view' },
          { type: 'waitForText', text: 'Select assemblies for dotplot view' },
          { type: 'delay', ms: 1500 },
        ],
      },
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
      // bottom frame: launch the linear synteny view, close the now-redundant
      // dotplot view (views[0], so the first close_view button) and let it draw
      {
        actions: [
          { type: 'click', text: 'Open linear synteny view' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="synteny_canvas_done"]',
          },
          { type: 'delay', ms: 2000 },
          { type: 'click', selector: '[data-testid="close_view"]' },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // RNA-seq tutorial screenshots (use hg19 ACTB region from DEMO_CONFIG)
  // ────────────────────────────────────────────────────────────────────────

  // Basic splicing: ACTB RNA-seq reads at exon-scale zoom so the spliced
  // alignments (grey read blocks joined by thin teal skip lines across introns)
  // are individually visible, with the gene model above. Replaces the old
  // rnaseq/overview, which duplicated the reads_zoomed view.
  {
    mode: 'url',
    name: 'rnaseq/basic_splicing',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr7:5,567,000-5,570,000',
          tracks: ['ncbi_gff_hg19', 'Pairend_StrandSpecific_51mer_Human_hg19'],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    // crop off the empty viewport below the (short) two-track stack
    crop: { x: 0, y: 0, width: 1500, height: 250 },
  },

  // Compact read drawing mode: featureHeight 3 / spacing 0 packs the full ACTB
  // read stack into view, with maxHeight raised so the whole pileup renders
  // instead of clipping at "Max layout height reached" — that full, dense stack
  // (deep = highly expressed) is the point compact mode makes, and what the
  // reviewer found unclear at the default maxHeight.
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
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                featureHeight: 3,
                featureSpacing: 0,
                maxHeight: 2000,
                height: 700,
                // ACTB's real minus-strand introns have 449/290/29/27/4 reads;
                // the spurious forward-strand sashimi arcs are single-/2-read
                // aligner noise (correct XS-tag strand, just low support). A
                // min-support of 3 drops the noise, keeps the real junctions.
                minSashimiScore: 3,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 1000,
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
          loc: 'chr1:1-1,200,000',
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
    annotations: [
      {
        type: 'box',
        anchor: { text: 'Multi-sample variant display (matrix)' },
      },
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
    annotations: [{ type: 'box', anchor: { text: 'Phased' } }],
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

  // LGV assembly/sequence import form (quickstart_web.md) — a linear genome view
  // with an assembly but no region opens on the assembly + sequence selectors.
  {
    mode: 'url',
    name: 'lgv_assembly',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    // smaller window keeps the focus on the compact import form
    viewportWidth: 900,
    viewportHeight: 560,
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
      // canvas-drawn gene glyph: at this zoom the label is baked into the canvas
      // (no DOM text / overlay div to target), so a coordinate click is required
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'extrafield' },
      { type: 'delay', ms: 2000 },
    ],
    // ring the formatDetails-generated hyperlink in the feature-details panel,
    // with the explanatory text above it. The previous arrow landed its head on
    // the link itself, covering the link text — the ring alone identifies it.
    annotations: [
      {
        type: 'circle',
        anchor: { selector: 'a[href^="https://google.com/?q="]' },
      },
      {
        type: 'text',
        x: 700,
        y: 150,
        text: 'The callback turns the name into a clickable link',
        // white-on-dark pill to match the other annotated figures (reviewer)
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
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
    // call out the "Open from track" workflow with the text off to the right and
    // the arrow pointing right-to-left at the radio, so neither overlaps the URL
    // text box below
    annotations: [
      {
        type: 'text',
        text: 'You can also load SV calls from a VCF track already in the session',
        x: 870,
        y: 250,
        background: 'rgba(0,0,0,0.8)',
        textColor: '#fff',
        fontSize: 15,
      },
      {
        type: 'arrow',
        from: { x: 1080, y: 270 },
        anchor: { text: 'Open from track' },
        dy: -6,
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

  // Declarative protein3d demo, autogenerated against the deployed app with the
  // protein3d plugin runtime-loaded from the jbrowse.org plugin rehosting (the
  // rehosted config at jbrowse.org/plugins/jbrowse-plugin-protein3d/dist carries
  // the `plugins:[{name:'Protein3d', url:<the jbrowse.org-hosted umd>}]` array).
  // Same-origin (jbrowse.org config + jbrowse.org app) so no cross-origin trust
  // prompt. The session spec launches a standalone ProteinView for BRAF (UniProt
  // P15056) via the plugin's LaunchView-ProteinView extension point; the
  // structure streams from AlphaFold DB and renders on the mol* WebGL canvas
  // (software WebGL via --enable-unsafe-swiftshader is sufficient headless).
  {
    mode: 'url',
    name: 'protein/structure',
    url: `https://jbrowse.org/code/jb2/latest/?config=${encodeURIComponent(
      'https://jbrowse.org/plugins/jbrowse-plugin-protein3d/dist/config.json',
    )}&session=${encodeURIComponent(
      `spec-${JSON.stringify({
        views: [
          {
            type: 'ProteinView',
            url: 'https://alphafold.ebi.ac.uk/files/AF-P15056-F1-model_v6.cif',
          },
        ],
      })}`,
    )}`,
    readySelector: 'canvas',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Connected genome + protein demo (TP53 / UniProt P04637). A single ProteinView
  // spec entry creates and connects its own LinearGenomeView via the plugin's
  // `connectedView` launch param, so the genome (NCBI RefSeq + ClinVar) and the
  // AlphaFold structure load linked. This uses the short-form declarative launch:
  // from just `uniprotId` + `transcriptId` the plugin derives the AlphaFold
  // structure URL, resolves the transcript feature from the hg38-ncbiRefSeq track
  // at `loc`, and translates its CDS to the protein sequence it aligns to the
  // structure. Requires a local jbrowse-plugin-protein3d build that supports the
  // uniprotId/transcriptId short form (`pnpm start`, PORT=9000). curated, so a
  // normal regen keeps the committed PNG; drop `curated` (with that local build)
  // to re-shoot it.
  {
    mode: 'url',
    curated: true,
    name: 'protein/connected',
    url: `http://localhost:9000/.test-jbrowse-nightly/?config=/config.json&session=${encodeURIComponent(
      `spec-${JSON.stringify({
        views: [
          {
            type: 'ProteinView',
            uniprotId: 'P04637',
            transcriptId: 'NM_000546.6',
            height: 540,
            connectedView: {
              assembly: 'hg38',
              loc: 'chr17:7,668,421-7,687,550',
              tracks: ['hg38-ncbiRefSeq', 'clinvar_ncbi_hg38'],
            },
          },
        ],
      })}`,
    )}`,
    readySelector: 'canvas',
    readyTimeout: 90000,
    settleMs: 15000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Clustering workflows
  // ────────────────────────────────────────────────────────────────────────

  // Multi-wiggle clustering, two-stage figure over the PUR copy-number panel
  // (1000 Genomes kidd-lab CNV bigWigs, 104 PUR individuals) added to
  // config_demo — a far richer dataset than the synthetic volvox wiggle
  // (reviewer). Shown across the AMY1 locus (chr1, hg38), a classic
  // copy-number-polymorphic region, so the per-individual copy-number differences
  // drive a meaningful clustering. Top frame: the "Cluster by score" dialog open
  // (auto/manual mode, before). Bottom frame: after "Run clustering", the 104
  // rows are reordered by signal similarity with a dendrogram on the left.
  // Combines the old cluster_dialog + clustered_result into one before/after.
  {
    mode: 'url',
    name: 'multiwig/cluster_dialog',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:103,500,000-104,800,000',
          tracks: [
            {
              trackId: 'pur_copynumber_1000g',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                height: 420,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'PUR',
    readySelector: '[data-testid="multi-wiggle-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 620,
    settleMs: 15000,
    stages: [
      {
        // top frame: the Cluster by score dialog open, before clustering
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Cluster rows by score' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Cluster rows by score' },
          { type: 'waitForText', text: 'Run clustering' },
          { type: 'delay', ms: 500 },
        ],
      },
      {
        // bottom frame: run clustering, then show reordered rows + dendrogram
        actions: [
          { type: 'click', text: 'Run clustering' },
          { type: 'waitForText', text: 'Run clustering', hidden: true },
          { type: 'delay', ms: 7000 },
        ],
      },
    ],
  },

  // Multi-sample variant clustering, two-stage figure over the volvox
  // "1000genomes vcf" track (volvox_test_vcf, real 1000-genomes sample panel —
  // reviewer asked for this instead of the synthetic multi-sample SV track).
  // Top frame: the "Cluster by genotype" dialog open (before). Bottom frame:
  // after "Run clustering", the samples are reordered by genotype similarity
  // with a dendrogram on the left. Combines the old cluster_dialog +
  // clustered_result screenshots into one multi-part figure (reviewer).
  {
    mode: 'url',
    name: 'variants/cluster_dialog',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_test_vcf',
              displaySnapshot: {
                type: 'LinearMultiSampleVariantMatrixDisplay',
                height: 400,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 8000,
    viewportHeight: 700,
    stages: [
      {
        // top frame: the Cluster by genotype dialog open, before clustering
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Cluster by genotype' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Cluster by genotype' },
          { type: 'waitForText', text: 'Run clustering' },
          { type: 'delay', ms: 500 },
        ],
      },
      {
        // bottom frame: run clustering, then show the reordered rows + dendrogram
        actions: [
          { type: 'click', text: 'Run clustering' },
          { type: 'waitForText', text: 'Run clustering', hidden: true },
          { type: 'delay', ms: 10000 },
        ],
      },
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
