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
  color?: string // default red (#e3242b); also the 'text' pill border color
  textColor?: string // circle badge label color (circle default white)
  // for 'text': a white rounded pill with a red border and black text is always
  // drawn behind the label so callouts read consistently over busy page content.
  // (background/textColor are ignored for 'text' to keep every callout uniform.)
  background?: string
  // for 'text': wrap the label onto multiple lines once it exceeds this width in
  // CSS px (default 420)
  maxWidth?: number
  fontSize?: number // text/circle label, default 22 for text (min 18)
  strokeWidth?: number // box/circle stroke width (default 5)
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
  // per-spec override of the content-stable diff gate (fraction of pixels in
  // [0,1]). Raise it for specs with irreducible render jitter — remote-data
  // timing, heavy text, animated chrome — so an unchanged capture isn't
  // re-committed every regen. Prefer making the capture reproducible first;
  // reach for this only when the jitter can't be designed out. Defaults to the
  // global DEFAULT_DIFF_THRESHOLD.
  diffThreshold?: number
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
// HG002 ultralong ONT BAM (the same NCBI GIAB file the DEMO_CONFIG
// hg002_nanopore track points at). Used to build the two HP-grouped session
// subtracks the smalldel group-by figure renders.
const HG002_NANOPORE_BAM =
  'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam'
const HG002_NANOPORE_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG002_NANOPORE_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${HG002_NANOPORE_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
const DEMO_CONFIG = 'test_data/config_demo.json'
// Local config that loads the Protein3d plugin from the jbrowse.org plugin-store
// rehosting's version-agnostic `latest/` path (not unpkg, no version to bump).
// See products/jbrowse-web/test_data/.
const PROTEIN3D_CONFIG = 'test_data/protein3d_config.json'
// Load the remote demo configs against the *local* build (a bare ?config= url
// that the generator prefixes with localhost), so unreleased display settings
// like the LinearSyntenyView drawCurves view property render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns the
// bare url into a jbrowse.org/code/jb2/latest link for the docs reader links.
const CGIAB_BASE = `?config=${encodeURIComponent('https://jbrowse.org/demos/cgiab/config.json')}`
const HPYLORI_BASE = `?config=${encodeURIComponent('https://jbrowse.org/demos/hpylori/config.json')}`

function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// Expand a menu drill-down into wait/hover/delay actions: each non-terminal item
// is hovered to open its submenu; the terminal item is only waited for. The
// caller lists the whole path, so an intermediate level can't be skipped — the
// failure that left `modifications1` waiting on a submenu its parent never
// opened. Pair with `cascadeBoxes` to keep the callout boxes on the same path.
function menuCascade(path: string[], delayMs = 500): ScreenshotAction[] {
  return path.flatMap((text, i) => {
    const parent = path[i - 1]
    return [
      ...(parent ? [{ type: 'hover' as const, text: parent }] : []),
      { type: 'waitForText' as const, text },
      { type: 'delay' as const, ms: delayMs },
    ]
  })
}

// Box every item along a menu path — the callout counterpart to `menuCascade`,
// so the highlighted items can't drift from the items actually hovered.
function cascadeBoxes(path: string[]): Annotation[] {
  return path.map(text => ({ type: 'box' as const, anchor: { text } }))
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
        // 2-D form: tracks[i] is the synteny shown between views[i] and
        // views[i+1]. A flat string[] is treated as a single level-0 entry, so
        // the level-1 band (chc155 vs j99) stayed empty — this nests each track
        // onto its own adjacent-pair level.
        tracks: [['26695_vs_chc155.pif'], ['chc155_vs_j99.pif']],
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
            // j99 aligns to chc155 in inverted orientation, so the [rev]
            // suffix flips this panel (declarative loc-string reverse) to
            // straighten the level-1 ribbons — otherwise they cross in an X
            loc: 'NZ_CP011330.1:872350-884982[rev]',
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
    viewportWidth: 1000,
    viewportHeight: 550,
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
    viewportWidth: 1000,
    viewportHeight: 550,
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
    // start at a single chromosome so the figure can walk through the setup
    // (reviewer: show how to build this view). Stage 1 opens the View → Show...
    // menu with "Show all regions in assembly" boxed; stage 2 is the result.
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr10',
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
    // tall enough to capture the open View → Show... submenu in stage 1
    crop: { x: 0, y: 0, width: 1500, height: 420 },
    stages: [
      {
        // top frame: single chromosome, View → Show... submenu open with
        // "Show all regions in assembly" boxed — the one click that zooms the
        // view out to the whole genome
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Show...', 'Show all regions in assembly']),
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Show all regions in assembly' } },
        ],
      },
      {
        // bottom frame: after the click the view spans every chromosome and the
        // scatter coverage resolves whole-genome copy-number structure
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          { type: 'delay', ms: 12000 },
        ],
      },
    ],
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
    viewportWidth: 1100,
    viewportHeight: 400,
    readyText: 'ctgA',
    settleMs: 3000,
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
    ],
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
    // narrower window keeps the soft-clip breakpoint in focus (reviewer request)
    viewportWidth: 700,
    settleMs: 4000,
  },

  // Realistic arc display on HG002 (reviewer asked for HG002 Illumina reads +
  // HG002 SV calls instead of SKBR3). HG002 is the GIAB Ashkenazi son
  // (NA24385) reference sample — real sequencing data, not a synthetic dataset.
  // The reviewer-requested chr1:72,548,824-73,163,654 window (~615 kb) spans an
  // HG002 structural variant: Illumina 2x250 pairs flanking the SV get a
  // larger-than-expected insert size, so readConnections:'arc' draws them as
  // long red discordant arcs while concordant pairs stay small grey arcs. The
  // HG002 GIAB consensus SV VCF sits on top so the call lines up with the arc
  // signature. At ~615 kb the window is far above AUTO_FORCE_LOAD_BP (20 kb), so
  // the BAM would normally show a force-load prompt; userByteSizeLimit lifts the
  // fetch-size gate (same mechanism the smalldel/multisv specs use) so the reads
  // auto-load headless instead of sitting on the prompt. Uses a region-slice of
  // the Illumina BAM (1:72.6-73.1Mb, ~111k reads, 19MB) rehosted on
  // jbrowse.org/demos/hg002 — the full remote NCBI ftp-trace BAM intermittently
  // timed out here (60s nav). Arcs only need each read's stored mate position
  // (RNEXT/PNEXT), so a region slice renders the same discordant signature.
  {
    mode: 'url',
    name: 'alignments/arc_display',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_illumina_chr1_arc_slice',
          name: 'HG002 Illumina hs37d5.2x250 (chr1 arc slice)',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'BamAdapter',
            uri: 'https://jbrowse.org/demos/hg002/HG002.hs37d5.2x250.chr1_72.6-73.1Mb.bam',
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:72,650,000-73,060,000',
          tracks: [
            'variants_hg002',
            {
              trackId: 'hg002_illumina_chr1_arc_slice',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                readConnections: 'arc',
                readConnectionsDown: true,
                // hide the stacked pileup so only the coverage histogram and the
                // discordant-pair arcs show (reviewer: "Show pileup" track-menu
                // toggle). The arc band gets the freed vertical room.
                showPileup: false,
                readConnectionsHeight: 220,
                height: 290,
                featureHeight: 3,
                featureSpacing: 0,
                userByteSizeLimit: 500_000_000,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG002 Illumina',
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
                coverageHeight: 100,
                readConnectionsHeight: 100,
                height: 600,
                userByteSizeLimit: 500_000_000,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 520,
    // NOTE: the samplot read-cloud display currently hangs on "Loading" in the
    // local build (the same CRAM loads fine via group_by_strand), so this spec
    // can't be regenerated until that load regression is fixed; the committed
    // PNG predates it. The coverageHeight/readConnectionsHeight bumps above are
    // the reviewer's taller-panels fix for when it can re-render.
    settleMs: 25000,
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

  // Color-by-CDS frame coloring on a gene track: human BRCA1 (hg19 NCBI RefSeq)
  // with colorByCDS on at the view level, so each CDS segment is tinted by its
  // reading frame. The window spans several small coding exons whose reading
  // frames differ, so the per-frame colors are visible. Too zoomed-out for
  // peptide lettering, so only the frame colors show.
  {
    mode: 'url',
    name: 'gene_track_color_by_cds',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr17:41,222,000-41,235,000',
          colorByCDS: true,
          tracks: ['ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 500,
  },

  // Peptide lettering: zoomed into the large BRCA1 exon 11 with the reference
  // sequence track above, colorByCDS on. Below ~1/8 bp/px the per-codon amino
  // acid letters are drawn over the frame-colored CDS, lined up with the codons
  // in the sequence track.
  {
    mode: 'url',
    name: 'gene_track_peptides',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr17:41,244,000-41,244,120',
          colorByCDS: true,
          tracks: ['Pd8Wh30ei9R', 'ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 500,
  },

  // Viral polyprotein: the enterovirus D ORF1 CDS is cleaved into mature
  // peptides (mature_protein_region_of_CDS). They render as stacked rows, each
  // colored from a distinct palette and individually hoverable; the labels.name
  // config in the track surfaces each region's GFF `product` (VP1, 2A, 3C, …).
  {
    mode: 'url',
    name: 'gene_track_mature_peptides',
    url: sessionSpec('test_data/enterovirus_d/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GCF_000861205.1',
          loc: 'NC_001430.1:727-7,311',
          tracks: [
            {
              trackId: 'ncbi_genes_enterovirus_d',
              // tall enough for the gene row + all 12 stacked mature peptides
              displaySnapshot: { type: 'LinearBasicDisplay', height: 220 },
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI genes',
    readyTimeout: 30000,
    settleMs: 4000,
    viewportHeight: 360,
  },

  // Collapse introns + RNA-seq sashimi: BRCA1 (hg38) with the MANE transcript
  // and a direct-RNA nanopore track. Right-clicking the gene and choosing
  // "Collapse introns" reshapes the view to the exons placed side by side; the
  // sashimi arcs from the RNA-seq splice junctions then connect adjacent exons.
  {
    mode: 'url',
    name: 'gene_track_collapse_introns',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:43,044,295-43,125,483',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              // one clean transcript per gene so the BRCA1 glyph + label is tidy
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
            'NA12878-DirectRNA.pass.dedup.NoU.fastq.hg38.minimap2.sorted',
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 600,
    hideTooltip: true,
    // remote nanopore RNA-seq: pileup/sashimi positions jitter run-to-run, so
    // allow more drift before re-committing the PNG
    diffThreshold: 0.03,
    actions: [
      // right-click the gene's floating-label DOM element (not a raw pixel) —
      // robust and exercises the label's real context-menu affordance
      { type: 'rightclick', text: 'BRCA1' },
      { type: 'waitForText', text: 'Collapse introns' },
      { type: 'delay', ms: 600 },
      { type: 'click', text: 'Collapse introns' },
      { type: 'waitForText', text: 'Replace current view' },
      { type: 'delay', ms: 600 },
      { type: 'click', text: 'Replace current view' },
      { type: 'waitForText', text: 'Replace current view', hidden: true },
      // let the reshaped view kick off its refetch, then wait out the remote
      // RNA download so the sashimi arcs are present in the capture
      { type: 'delay', ms: 2000 },
      {
        type: 'waitForSelector',
        selector: '[data-testid="loading-overlay"]',
        hidden: true,
      },
      { type: 'delay', ms: 3000 },
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
    viewportWidth: 1000,
    viewportHeight: 550,
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
    // narrower + shorter window keeps the breakpoint in focus and trims the
    // empty space below the short result-frame pileup (reviewer request)
    viewportWidth: 900,
    viewportHeight: 480,
    settleMs: 4000,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Show...', 'Show soft clipping']),
        ],
        // box both the parent "Show..." submenu and the "Show soft clipping"
        // item it opens (reviewer asked to also circle "Show...")
        annotations: [
          { type: 'box', anchor: { text: 'Show...' } },
          { type: 'box', anchor: { text: 'Show soft clipping' } },
        ],
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
    // narrower + a touch shorter than before (reviewer), but still tall enough
    // that the SAMPLES card (low in the variant-details panel) stays on-screen —
    // the callouts anchor to it, so it must be visible
    viewportWidth: 1150,
    viewportHeight: 880,
    actions: [
      { type: 'click', text: 'C -> T' },
      { type: 'waitForText', text: 'HG00096' },
      { type: 'delay', ms: 1500 },
    ],
    // label the SAMPLES genotype table directly: pill sits just above the
    // SAMPLES header (anchored, so it tracks the card instead of floating far
    // away in the top-left), with a short arrow into it (reviewer)
    annotations: [
      { type: 'box', anchor: { text: 'SAMPLES' } },
      {
        type: 'text',
        anchor: { text: 'SAMPLES' },
        dy: -52,
        dx: -40,
        maxWidth: 220,
        text: 'Per-sample genotypes',
      },
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
      { type: 'click', text: 'Filter...' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Edit filters...' },
      { type: 'delay', ms: 1000 },
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
    // Whole-genome grape vs peach MCScan synteny as an explicit controlled
    // session (was a reviewer share link whose mismatched per-panel zoom fanned
    // ribbons far off the left edge — the "drawing offscreen" the review
    // flagged). Both panels span their full assemblies at matched scale, so the
    // bezier ribbons stay inside the view. minAlignmentLength drops short-anchor
    // noise; drawCurves + per-query color + low alpha keep them legible.
    url: sessionSpec('test_data/config_dotplot.json', {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_mcscan'],
          drawCurves: true,
          colorBy: 'query',
          // higher alpha + a taller synteny band give the ribbons room to read,
          // and autoDiagonalize reorders the panels into clean diagonals
          // (reviewer: increase height, add opacity, diagonalize; then opacity
          // bumped a little more). levelHeights (not a `levels` snapshot) is the
          // key the launch init consumes.
          alpha: 0.65,
          levelHeights: [360],
          autoDiagonalize: true,
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
        },
      ],
    }),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
  },

  // For the gallery: load the exact curated share session the reviewer wants
  // captured verbatim (peach Pp05 vs grape chr2 with the per-gene MCScan
  // connections + the red/blue inverted-vs-non-inverted synteny blocks). The
  // bare ?config= url is served against the local build; the password param
  // auto-decrypts the shared session so it loads with no interaction. The
  // docs live-link becomes the same query on jbrowse.org/code/jb2/latest.
  {
    mode: 'url',
    name: 'linear_synteny_gallery',
    url: '?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt',
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 10000,
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

  // Center line over the pileup with the View menu's Show... → Show center line
  // item boxed in the same frame (reviewer: show the menu path and the result
  // together). showCenterLine starts true so the line is already visible behind
  // the open menu.
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
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      ...menuCascade(['Show...', 'Show center line']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Show center line' } }],
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
          ...menuCascade(['SNP/Mismatch', 'Sort by base at position']),
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

  // A single spliced RNA-seq read: zoomed into the SDF4 first-intron boundary on
  // hg19 so individual reads spanning the intron show the grey exon-aligned ends
  // joined by a thin skipped-intron bar. Hovering a read in the pileup surfaces
  // its read-name tooltip. Replaces a hand-curated capture.
  {
    mode: 'url',
    name: 'rnaseq/single_read',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:1,158,453-1,159,425',
          tracks: [
            {
              trackId: 'ncbi_gff_hg19',
              displaySnapshot: { type: 'LinearBasicDisplay', height: 90 },
            },
            'Pairend_StrandSpecific_51mer_Human_hg19',
          ],
        },
      ],
    }),
    readyText: 'SDF4',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 640,
    // hover a read in the pileup (left of the intron gap, over an exon-aligned
    // segment, below the coverage band) so its read-name tooltip shows
    actions: [
      { type: 'hover', from: { x: 300, y: 360 } },
      { type: 'delay', ms: 1500 },
    ],
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

  // CRAM modifications + bedmethyl together over a CpG island (chr20 18.49-18.51Mb,
  // the same island the `modifications` figure uses) so there is a clear
  // methylated/unmethylated transition — the old chr20:10Mb window had little
  // signal (reviewer). The COLO829 nanopore reads' per-base CpG methylation calls
  // (colorBy methylation) line up with the modkit bedmethyl summary below. The
  // bedmethyl uses the multi-row-density renderer (a value-gradient heatmap), not
  // the default two-color xyplot whose negColor never shows for an all-positive
  // 0-100 methylation percentage (reviewer: don't use twocolor — it only showed
  // the one red color).
  {
    mode: 'url',
    name: 'methylation/colo829_cram_and_bedmethyl',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // zoomed into a ~2.5kb core of the CpG island (was ~18kb, then ~5kb)
          // so the per-base methylation calls + bedmethyl transition are legible
          // rather than a tiny large-scale smear (reviewer asked to zoom further)
          loc: 'chr20:18,500,750-18,503,250',
          tracks: [
            {
              trackId: 'COLO829_tumor.ht',
              displaySnapshot: {
                // one-color modifications rendering (only methylated calls
                // colored) rather than the two-color methylation mode whose
                // blue "unmethylated" signal has no counterpart in the
                // bedmethyl track below (reviewer)
                colorBy: { type: 'modifications' },
              },
            },
            {
              trackId: 'COLO829_tumor.ht_modkit.bed_multi',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multirowdensity',
                minScore: 0,
                maxScore: 100,
                height: 150,
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

  // The same modifications CRAM shown twice — top row in modifications mode (each
  // call drawn at its MM-tag position), bottom row in methylation mode (both
  // modified and reference-CpG-inferred unmodified positions) — over a UCSC CpG
  // island on chr20. The config track (human_chr20_mod_call_5mC_5hmC_CG_cram)
  // supplies the methylation-mode row; a sessionTrack copy with its own trackId
  // supplies the modifications-mode row (the same trackId can't appear twice in a
  // view). The island is hypo-methylated, so the methylation row has no marks
  // inside it. Replaces a hand-curated capture.
  {
    mode: 'url',
    name: 'alignments/modifications2',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
          name: 'human_chr20_mod_call_5mC_5hmC_CG (CRAM) (modifications)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'CramAdapter',
            cramLocation: {
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram',
              locationType: 'UriLocation',
            },
            craiLocation: {
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram.crai',
              locationType: 'UriLocation',
            },
            sequenceAdapter: {
              type: 'BgzipFastaAdapter',
              fastaLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                locationType: 'UriLocation',
              },
              faiLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
                locationType: 'UriLocation',
              },
              gziLocation: {
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:19,749,666-19,770,134',
          tracks: [
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
              displaySnapshot: {
                colorBy: { type: 'modifications' },
                // lift the fetch-size gate so the CRAM auto-loads headless
                // instead of sitting on the force-load prompt (same mechanism
                // as the arc_display spec)
                userByteSizeLimit: 500_000_000,
              },
            },
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram',
              displaySnapshot: {
                colorBy: { type: 'methylation' },
                userByteSizeLimit: 500_000_000,
              },
            },
            'cpgisland_ucsc_hg38',
          ],
        },
      ],
    }),
    readyText: 'CpG',
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

  // Same SKBR3 SV inspector as above, but with the spreadsheet quick-filter
  // applied. This SKBR3 sniffles set is all translocations, so the filter
  // subsets by chromosome: typing "X" narrows the table to the calls involving
  // chrX (matching the CHROM / INFO CHR2 columns — "X" doesn't appear in the
  // numeric POS/ID columns), and the circular overview redraws to only those
  // chords. Replaces a stale hand-curated capture of the old labeled "text
  // filter" UI (the app now uses the MUI DataGrid quick-filter).
  {
    mode: 'url',
    name: 'sv_inspector_importform_filtered',
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
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'X',
        clear: true,
      },
      { type: 'delay', ms: 4000 },
    ],
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
                // explicit colors: the multiwig source color is now assigned by
                // post-filter index, which flipped tumor/normal vs origin/main
                // (reviewer). Pin tumor=red, normal=blue (set1 palette).
                color: '#e41a1c',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                source: 'COLO829 normal',
                color: '#377eb8',
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
                // scatter resolves copy-number structure (reviewer: even finer,
                // then bumped again for slightly higher resolution — the BigWig
                // zoom levels are discrete, so this has to cross a level to add
                // detail)
                resolution: 50,
                // shrink scatter points (default 2px) so the dense CNV cloud
                // reads as fine structure rather than blobs (reviewer)
                scatterPointSize: 1,
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
  // used to drive a group-by-HP example (reviewer). A single HG002 ultralong-ONT
  // track uses the display's groupBy:{type:'tag',tag:'HP'} option, which splits
  // the pileup into one subtrack per HP value at render time (the newer built-in
  // grouping — no manually-filtered duplicate session tracks). The heterozygous
  // deletion concentrates in a single haplotype, so it shows in one group and
  // not the other — a cleaner read than a colored+sorted single pileup. The HG002
  // GIAB consensus SV VCF (the DEL call) sits on top. userByteSizeLimit lifts the
  // force-load byte gate so the reads auto-load instead of sitting on "Loading";
  // readySelector waits for the pileup canvas to actually paint before capture.
  //
  // NOTE (color regression, reported separately): coloring HG002 reads by the HP
  // tag now uses the darker MUI-200 TAG_COLOR_PALETTE
  // (plugins/alignments/src/LinearAlignmentsDisplay/colorTagUtils.ts) instead of
  // origin/main's pale Paul-Tol palette, so the haplotypes read darker than the
  // old "nice pink and blue". That palette is a code constant, not a spec field,
  // so it is not fixed here.
  {
    mode: 'url',
    name: 'smalldel',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_nanopore_hp',
          name: 'HG002 ONT',
          assemblyNames: ['hg19'],
          adapter: HG002_NANOPORE_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,675-63,007,432',
          tracks: [
            'variants_hg002',
            {
              trackId: 'hg002_nanopore_hp',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                height: 400,
                userByteSizeLimit: 200_000_000,
                groupBy: { type: 'tag', tag: 'HP' },
                colorBy: { type: 'tag', tag: 'HP' },
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
            // NCBI RefSeq gene track below the variant display (reviewer).
            // showLabels:'on' forces gene names on (the default 'auto' hides
            // them at this 5Mb zoom past maxLabelFeatureDensity); showOnlyGenes
            // drops the per-transcript/mRNA subfeatures so only the gene-level
            // glyphs (and their labels) render; showDescriptions:false keeps the
            // track compact (gene symbols only, no description line — reviewer).
            {
              trackId: 'ncbi_refseq_109_hg38',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                height: 140,
                showLabels: 'on',
                showDescriptions: false,
                showOnlyGenes: true,
              },
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
  // callset, at a ~43kb SV locus. The full NCBI 1000genomes CRAMs 503'd
  // intermittently (reviewer saw an error), so each is sliced to this locus
  // (chr1:40,476,000-40,530,000, ~12-14k reads, <1MB BAM) and rehosted on
  // jbrowse.org/demos/kgp-trio so the reads auto-load fast and reliably.
  // Per-track heights capped so all four tracks fit one viewport.
  {
    mode: 'url',
    name: 'multi-sv-trio',
    url: kgUrl({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02030_trio_slice',
          name: 'HG02030 (child)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02031_trio_slice',
          name: 'HG02031 (mother)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02031_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02031_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02032_trio_slice',
          name: 'HG02032 (father)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02032_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02032_trio_slice.bam.bai',
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
          assembly: 'hg38',
          loc: '1:40,481,472-40,524,349',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02030_trio_slice',
              displaySnapshot: { height: 180 },
            },
            {
              trackId: 'HG02031_trio_slice',
              displaySnapshot: { height: 180 },
            },
            {
              trackId: 'HG02032_trio_slice',
              displaySnapshot: { height: 180 },
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
        text: 'Automatically launches a breakpoint split view for the TRA SV. Paired-end and long reads also have this in their feature details.',
      },
    ],
  },

  {
    mode: 'url',
    name: 'breakpoint_split_view',
    // Declarative reconstruction of the old share session (share-ITpNXoz07O):
    // SKBR3 ngmlr split-read CRAM + Sniffles VCF over the chr1<->chr5
    // interchromosomal translocation. Each panel is a loc window centered on
    // its breakpoint (chr1:229,354,402 // chr5:137,884,948). The alignments
    // display height is shortened to 140 (was ~250) so the pileups aren't tall
    // (reviewer); the intra-view links are toggled off via the view menu below
    // so only the cross-panel junction splines draw (reviewer).
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          showIntraviewLinks: false,
          views: [
            {
              assembly: 'hg19',
              loc: '1:229,347,000-229,362,000',
              tracks: [
                {
                  trackId: 'ngmlr_splitters_cram',
                  displaySnapshot: { height: 140 },
                },
                'breast_cancer_sniffles_hg19',
              ],
            },
            {
              assembly: 'hg19',
              loc: '5:137,877,000-137,892,000',
              // bottom panel mirrors the top: variants above reads (so the two
              // pileups sit adjacent across the junction) — reviewer
              tracks: [
                'breast_cancer_sniffles_hg19',
                {
                  trackId: 'ngmlr_splitters_cram',
                  displaySnapshot: { height: 140 },
                },
              ],
            },
          ],
        },
      ],
    }),
    readyText: 'SKBR3',
    // both panels + connecting splines fit comfortably now that the pileups are
    // shorter
    viewportHeight: 760,
    readyTimeout: 60000,
    settleMs: 15000,
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
    // bare ?config= so it renders against the local build
    url: '?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe',
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Alignments-track doc screenshots, autogenerated from real-human data in
  // DEMO_CONFIG (SKBR3 illumina / HG002 multi-track / 1KGP) so the colored
  // clip+insertion indicators and short-vs-long-read comparison match the doc
  // captions.

  // Colored clip indicator ticks above the coverage band. Uses the volvox
  // long-read SV BAM zoomed onto an SV breakpoint, where the reads clip hard at
  // a single column — producing a tall, unmistakable clip-indicator stack
  // (blue = left-clip, red = right-clip). The earlier SKBR3 illumina view was a
  // wide 28kb window where the ticks were tiny and scattered (reviewer).
  {
    mode: 'url',
    name: 'alignment_clipping_indicators',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:2,560-2,760',
          tracks: [
            {
              trackId: 'volvox-long-reads-sv-bam',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                // taller coverage band so the clip-indicator ticks above it are
                // large enough to read (default coverageHeight is 45)
                coverageHeight: 120,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    readyTimeout: 60000,
    settleMs: 8000,
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
                height: 1300,
                coverageHeight: 120,
                // taller reads so the minority green (same-orientation /
                // inverted) pairs are legible instead of 3px slivers (reviewer)
                featureHeight: 9,
                colorBy: { type: 'pairOrientation' },
                // legend is opt-in now; show the pair-orientation key so the
                // inversion color signature is readable
                showLegend: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // taller window so the enlarged pileup + the feature-details sidebar fit
    // (reviewer request)
    viewportHeight: 1600,
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
    // label the CPX_TYPE INFO field and explain the read evidence (the small
    // circle ring was hard to see — reviewer)
    annotations: [
      {
        type: 'arrow',
        from: { x: 980, y: 360 },
        anchor: { text: 'CPX_TYPE' },
      },
      {
        // drop into the empty white pileup band so it doesn't cover the arcs
        // at the top of the pileup, which are the key INVdup evidence (reviewer)
        type: 'text',
        x: 700,
        y: 760,
        text: 'Annotated as "INVdup" (inverted duplication)',
        fontSize: 26,
      },
      {
        type: 'text',
        x: 60,
        y: 470,
        text: 'The read pileup supports an INVdup: green same-orientation (LL/RR) pairs flag the inverted segment, while elevated coverage and the arc connections across the locus mark the extra duplicated copy.',
        maxWidth: 520,
      },
    ],
  },

  // Same INVdup locus as inverted_duplication, but with the linked-read *bezier*
  // connection mode (showBezierConnections) over an ordinary pileup instead of
  // coverage-band arcs. Each pair is drawn as a horizontal-tangent oval curve
  // spanning its two mates — the same curve shape BreakpointSplitView's
  // AlignmentConnections draws in a single linear view — so the green LL / blue
  // RR same-orientation pairs of the inverted segment stand out as bundled curves
  // across the locus. linkedReads stays off (mates keep their own pileup rows,
  // matching how a breakpoint split view lays reads out).
  {
    mode: 'url',
    name: 'inverted_duplication_bezier',
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
                showBezierConnections: true,
                height: 1300,
                coverageHeight: 120,
                featureHeight: 9,
                colorBy: { type: 'pairOrientation' },
                showLegend: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    viewportHeight: 1600,
    settleMs: 30000,
    annotations: [
      {
        type: 'text',
        x: 60,
        y: 470,
        text: 'Bezier connection mode: each read pair is a horizontal-tangent oval curve between its mates — the same curve shape a breakpoint split view draws. Green LL / blue RR same-orientation pairs bundle across the inverted-duplication locus.',
        maxWidth: 520,
      },
    ],
  },

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  // Single-frame SV-inspector launch: the app "Add" menu with the "SV inspector"
  // item boxed (reviewer: drop the second import-form stage — the import form
  // with the pasted VCF URL is its own figure, sv_inspector_importform_after).
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    // crop off the empty viewport below the menu
    crop: { x: 0, y: 0, width: 1500, height: 460 },
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'SV inspector' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'SV inspector' } }],
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
    // highlight the "Show all regions in assembly" button (reviewer request)
    annotations: [
      { type: 'box', anchor: { text: 'Show all regions in assembly' } },
    ],
  },

  // The SV inspector after searching for SV_85: the spreadsheet quick-filter is
  // typed with "SV_85" so the table narrows to that one benchmark deletion call,
  // and a linear genome view below is already navigated to the SV_85 locus
  // (chr10, in the CUZD1 gene) showing the same VCF track — the end state of
  // clicking the filtered row. Replaces a hand-curated capture.
  {
    mode: 'url',
    name: 'sv_cgiab/deletion_sv_inspector_search',
    url: cgiabUrl({
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,823,828-122,852,611',
          tracks: ['GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf'],
        },
      ],
    }),
    // 'chr1' shows in the inspector circular/table; the LGV location is an input
    // value (not matched as text), so wait on the inspector and let settle cover
    // the remote LGV navigation/VCF load
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 20000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'SV_85',
        clear: true,
      },
      { type: 'delay', ms: 4000 },
    ],
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
          // center line marks the sort column (the screen-center base the pileup
          // is sorted by — reviewer)
          showCenterLine: true,
          // The somatic SV VCF's SV_85 <DEL> call marks the deletion against the
          // NCBI RefSeq gene context (CUZD1), with the rehosted PacBio read slice
          // showing the supporting reads across the deletion.
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
            {
              trackId: 'hg008t_pacbio_chr10_deletion_slice',
              // compact pileup (reviewer): the "Compact" feature-height preset
              // sets featureHeight=3, featureSpacing=0 (COMPACTNESS_PRESETS),
              // both flat config-override keys on LinearAlignmentsDisplay
              displaySnapshot: {
                height: 300,
                featureHeight: 3,
                featureSpacing: 0,
                // sort reads by the base at the screen-center column (reviewer)
                sortedBy: {
                  type: 'basePair',
                  pos: 122836434,
                  refName: 'chr10',
                  assemblyName: 'GRCh38_GIABv3',
                },
              },
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
    // Whole chr5 with BOTH tumor and normal coverage in a single
    // MultiQuantitativeTrack (reviewer) above the somatic CNV benchmark bed
    // calls, so the coverage gains/losses can be compared against the called
    // intervals. Uses the normalized indexcov bigwigs (median≈1 → reads
    // directly as copy number).
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'hg008_cnv_indexcov_chr5',
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
          loc: 'chr5',
          // offset track labels so they overlay the tracks instead of taking a
          // dedicated row (reviewer)
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg008_cnv_indexcov_chr5',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multiscatter',
                autoscale: 'localsd',
                // finer binning (basesPerSpan = bpPerPx/resolution) so the
                // whole-chromosome scatter resolves more CNV detail (reviewer)
                resolution: 8,
                height: 200,
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
    // narrower + shorter capture (reviewer) — still wide enough for the 24
    // chromosomes and tall enough for the centered score dialog in stage 2
    viewportWidth: 1500,
    viewportHeight: 520,
    settleMs: 25000,
    // Four-stage figure (reviewer, absorbs the former cnv_score_limit spec and
    // makes the workflow legible): stage 1 is the autoscaled whole-genome
    // multi-bigwig; stage 2 shows the "Set min/max score" dialog open with the
    // cap entered (so the reader sees the action between before/after — reviewer:
    // it was unclear what happened); stage 3 is the capped result; stage 4
    // switches to overlapping scatter so normal vs tumor coverage share one band
    // (reviewer). The normalized indexcov domain runs ~0-2, so capping at 0-2.5
    // keeps a few centromere/repeat spikes from compressing the copy-number band.
    stages: [
      {},
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Score', 'Set min/max score'], 300),
          { type: 'click', text: 'Set min/max score' },
          { type: 'waitForText', text: 'Set min/max score for track' },
          { type: 'delay', ms: 500 },
          {
            type: 'type',
            selector: '[role="dialog"] input[placeholder="Enter min score"]',
            value: '0',
          },
          {
            type: 'type',
            selector: '[role="dialog"] input[placeholder="Enter max score"]',
            value: '2.5',
          },
          { type: 'delay', ms: 400 },
        ],
        annotations: [
          {
            type: 'text',
            anchor: { selector: '[role="dialog"]' },
            dy: -16,
            text: 'Cap the score range from the track menu (Score → Set min/max score)',
            maxWidth: 360,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Submit' },
          { type: 'delay', ms: 12000 },
        ],
      },
      {
        closeMenusFirst: true,
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Rendering type', 'Overlapping scatter'], 300),
          { type: 'click', text: 'Overlapping scatter' },
          { type: 'delay', ms: 12000 },
        ],
        annotations: [
          {
            type: 'text',
            x: 40,
            y: 150,
            maxWidth: 360,
            text: 'Switch to overlapping scatter (Rendering type → Overlapping scatter) to plot normal and tumor coverage in one band',
          },
        ],
      },
    ],
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
          // curved ribbons (drawCurves is a LinearSyntenyView-level property) so
          // the connections read clearly (reviewer). Renders against the local
          // build (cgiabUrl is now a bare ?config= url) so drawCurves is honored
          // — the published jb2/latest release predates it.
          drawCurves: true,
          // taller synteny band (LinearSyntenyViewHelper.height, default 100) so
          // the ribbons have room to spread out (reviewer). NB the launch init
          // handler consumes `levelHeights`, not a `levels` snapshot — the
          // latter is silently dropped, which is why the band stayed short.
          levelHeights: [260],
          // drop short noisy alignments and lighten the ribbons so the dense
          // "dark areas" (many overlapping anchors stacking opacity into solid
          // fans) read as clean syntenic blocks (reviewer)
          minAlignmentLength: 50000,
          alpha: 0.2,
          tracks: ['HG008T.hap1_pif'],
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
    // fit the taller curved synteny band + both LGV panels without a tall
    // white margin
    viewportHeight: 620,
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
    // No callouts: the import form already labels its two selectors ("x-axis
    // assembly"/"y-axis assembly"), and which assembly goes on which axis is
    // arbitrary here (the old "query"/"target" framing was a track-level
    // distinction the view doesn't impose), so added annotations only mislead
    // (reviewer).
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
  // Ensembl ID, not "FAF1".
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
    // Each label is a callout pill placed in clear space (the dark app bar or the
    // sparse overview-ruler band) with an arrow pointing at the control it names,
    // so the text no longer overlaps the icons or stacks on top of the other
    // labels in the cramped track-header row (reviewer). Targets are anchored, so
    // each arrow head tracks the real element; only the pill/tail use absolute
    // viewport CSS px (default 1500x800 capture).
    annotations: [
      // app-bar band: the two track-header controls, with long arrows down
      {
        type: 'text',
        text: 'Drag to reorder track',
        x: 250,
        y: 18,
        fontSize: 14,
      },
      {
        type: 'arrow',
        from: { x: 300, y: 38 },
        anchor: { selector: '[data-testid^="dragHandle-"]' },
      },
      { type: 'text', text: 'Track menu', x: 500, y: 18, fontSize: 14 },
      {
        type: 'arrow',
        from: { x: 540, y: 38 },
        anchor: { selector: '[data-testid="track_menu_icon"]' },
      },
      // "Add view" sits just under the Add menu it labels
      { type: 'text', text: 'Add view', x: 70, y: 50, fontSize: 14 },
      {
        type: 'arrow',
        from: { x: 95, y: 48 },
        anchor: { text: 'Add' },
      },
      // overview-ruler band: the four navigation controls, arrows pointing down
      // into the controls row
      { type: 'text', text: 'Pan', x: 520, y: 70, fontSize: 14 },
      {
        type: 'arrow',
        from: { x: 540, y: 88 },
        anchor: { selector: 'button[aria-label="Pan left"]' },
      },
      { type: 'text', text: 'Search box', x: 680, y: 70, fontSize: 14 },
      {
        type: 'arrow',
        from: { x: 750, y: 88 },
        anchor: { selector: 'input[placeholder="Search for location"]' },
      },
      { type: 'text', text: 'Zoom', x: 900, y: 70, fontSize: 14 },
      {
        type: 'arrow',
        from: { x: 935, y: 88 },
        anchor: { selector: '[data-testid="zoom_in"]' },
      },
      {
        type: 'text',
        text: 'Scroll-to-zoom toggle',
        x: 1030,
        y: 70,
        fontSize: 14,
      },
      {
        type: 'arrow',
        from: { x: 1110, y: 88 },
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
      },
    ],
  },

  // Scroll-to-zoom toggle: a single frame ringing the toggle button with a
  // callout explaining the click (the old second "enabled" frame was redundant
  // per reviewer). Narrow/short viewport keeps the figure cropped to the LGV
  // header.
  {
    mode: 'url',
    name: 'scroll_zoom_toggle',
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
    viewportWidth: 1000,
    viewportHeight: 220,
    annotations: [
      {
        type: 'circle',
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
      },
      {
        type: 'text',
        text: 'Click to enable scroll-to-zoom',
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
        dx: 70,
      },
    ],
  },

  // Add track: single frame (reviewer). The "Open track..." File-menu item and
  // the AddTrackWidget drawer it opens are shown together — open the drawer, then
  // reopen the File menu (clicking the item closes it) so both the menu path and
  // the resulting form are visible, with an arrow from the boxed menu item across
  // to the boxed add-track panel.
  {
    mode: 'url',
    name: 'add_track_form',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:1,000,000-1,100,000',
          tracks: ['ncbi_gff_hg19'],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    // smaller window so the File menu + add-track drawer are easy to read
    viewportWidth: 1000,
    viewportHeight: 560,
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 300 },
      // open the add-track drawer
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      { type: 'delay', ms: 1000 },
      // reopen the File menu so the menu path and the open form show together
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 400 },
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Open track...' } },
      // box just the add-track workflow form (not the whole full-height drawer,
      // whose box ran off the bottom of the capture)
      { type: 'box', anchor: { selector: '[data-testid="addTrackWorkflow"]' } },
      // arrow from the menu item across to the panel it opens
      {
        type: 'arrow',
        from: { x: 235, y: 150 },
        anchor: { selector: '[data-testid="addTrackWorkflow"]' },
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
          tracks: ['volvox_bam'],
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
      // click the add-track FAB so its popup menu opens (reviewer: show the add
      // track menu the FAB launches, not just a ring around the button)
      { type: 'click', selector: '[data-testid="hierarchical-add-track-fab"]' },
      { type: 'waitForText', text: 'Add track' },
      { type: 'delay', ms: 600 },
    ],
    annotations: [
      // ring the FAB and box the "Add track" item in the menu it opened
      {
        type: 'box',
        anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
      },
      { type: 'box', anchor: { text: 'Add track' } },
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
    viewportWidth: 1000,
    viewportHeight: 600,
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

  // Track label positioning submenu in the view menu, over volvox tracks. Uses
  // the light local volvox BAM (reviewer); local data settles quickly so the
  // MUI cascade stays open through capture. The view menu (hamburger) icon is
  // ringed so the reader can see where the menu was opened from; the expanded
  // submenu is boxed.
  {
    mode: 'url',
    name: 'tracklabels',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['volvox_bam'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      ...menuCascade(['Track labels', 'Overlapping']),
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="view_menu_icon"]' },
      },
      // box the Track labels parent item (its submenu expands to the right)
      { type: 'box', anchor: { text: 'Track labels' } },
    ],
  },

  // Track settings: the track menu's "Track actions" submenu with "Settings"
  // boxed — any track's settings can now be edited directly (a non-admin's
  // edits are saved as a session override), no Copy-track-first step needed.
  {
    mode: 'url',
    name: 'edit_track_settings',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          // static feature track keeps the MUI cascade open through capture
          tracks: ['gff3tabix_genes'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Track actions', 'Settings']),
    ],
    // box the "Track actions" parent submenu and the "Settings" item it opens
    // (reviewer asked to also highlight "Track actions")
    annotations: cascadeBoxes(['Track actions', 'Settings']),
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
          tracks: ['volvox_bam'],
        },
      ],
    }),
    readyText: 'ctgA',
    // smaller capture window in both dimensions (reviewer request)
    viewportWidth: 1150,
    viewportHeight: 470,
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
    viewportWidth: 1000,
    viewportHeight: 550,
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
      ...menuCascade(['Bookmarks/highlights', 'Open bookmark widget'], 300),
      { type: 'click', text: 'Open bookmark widget' },
      { type: 'waitForText', text: 'Add label...' },
      { type: 'delay', ms: 1000 },
      // single-click the "Add label..." cell to enter edit mode, then type
      { type: 'type', text: 'Add label...', value: 'my region' },
      { type: 'delay', ms: 1500 },
    ],
    // anchor to the "Label" column header in the bookmark widget (the edited
    // value lives in an <input>, which has no textContent to anchor to, so the
    // old anchor fell back to the top-left corner). The callout text is
    // left-aligned, so it's pulled well left of the right-side widget header and
    // width-clamped to keep it from running off the right edge (reviewer)
    annotations: [
      {
        type: 'text',
        text: 'Single-click the label to edit it',
        anchor: { text: 'Bookmark link' },
        dx: -260,
        dy: 60,
        maxWidth: 230,
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
      ...menuCascade(['Set feature height...', 'Compact'], 800),
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
          ...menuCascade(['Read connections', 'Show read arcs'], 600),
        ],
        // box the "Read connections" parent submenu plus the two options it
        // opens (reviewer asked to also highlight "Read connections")
        annotations: [
          { type: 'box', anchor: { text: 'Read connections' } },
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
                // legend is opt-in now; this teaching figure explicitly shows
                // the 5mC/5hmC color key
                showLegend: true,
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
    // colorBy:modifications is set declaratively so the mod data is already
    // loaded and painted by the time the menu opens. Then drive the live Color
    // by → Base modifications → Color by modification type → All modification
    // types path so the figure shows the menu route, not just the result
    // (reviewer asked to actually open the menu). The selector is scoped by
    // data-trackid to the COLO829 alignments
    // track — the bare track_menu_icon matched the CpG-island feature track
    // first, whose Color by menu has no modifications options.
    actions: [
      {
        type: 'click',
        selector:
          '[data-testid="track_menu_icon"][data-trackid="COLO829_tumor.ht"]',
      },
      ...menuCascade(
        [
          'Color by...',
          'Base modifications (MM tag)',
          'Color by modification type',
          'All modification types',
        ],
        800,
      ),
    ],
    annotations: cascadeBoxes([
      'Color by...',
      'Base modifications (MM tag)',
      'Color by modification type',
      'All modification types',
    ]),
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
          // no track opened — the figure is about the track-selector hamburger
          // menu, and an open gene track in the LGV behind it was distracting
          // (reviewer)
          tracks: [],
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
      ...menuCascade(['Collapse...', 'Collapse top-level categories']),
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
    viewportHeight: 600,
    settleMs: 8000,
    // single frame: open a track so it lands in "recently used", then open the
    // recently-used dropdown and highlight both the trigger icon and the popover
    // together (reviewer: one stage with both the icon and the popover ringed)
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
      // open the recently-used dropdown so the popover is visible in-frame
      {
        type: 'click',
        selector: '[data-testid="recently-used-tracks-button"]',
      },
      { type: 'waitForText', text: 'NCBI RefSeq w/ subfeature details' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [
      // ring the recently-used trigger icon and box its open popover together
      {
        type: 'circle',
        anchor: { selector: '[data-testid="recently-used-tracks-button"]' },
      },
      {
        type: 'box',
        anchor: { selector: '.MuiPopover-paper' },
        strokeWidth: 5,
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
          tracks: ['volvox_bam'],
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 560,
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
      { type: 'type', text: 'Filter tracks', value: 'volvox-sorted' },
      { type: 'delay', ms: 800 },
      // open the track's per-track menu (showing "Add to favorites")
      {
        type: 'click',
        selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
      },
      { type: 'waitForText', text: 'Add to favorites' },
      { type: 'delay', ms: 300 },
    ],
    stages: [
      {
        // ring the per-track moreVert menu trigger that was clicked, plus box
        // the "Add to favorites" item it opened (reviewer)
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
            },
          },
          { type: 'box', anchor: { text: 'Add to favorites' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add to favorites' },
          { type: 'delay', ms: 500 },
          { type: 'click', selector: '[data-testid="favorite-tracks-button"]' },
          { type: 'waitForText', text: 'volvox-sorted.bam' },
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
      ...menuCascade(['Rendering type', 'Multi-row XY plot']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Rendering type' } }],
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
    // smaller capture in both dimensions (reviewer); narrower than default but
    // still wide enough for the category "..." menu to cascade without clipping,
    // and the "Integration test" wiggle category renders within this height
    viewportWidth: 950,
    viewportHeight: 600,
    stages: [
      {
        actions: [
          // open the track selector via the in-view header button, not the view
          // hamburger menu, which would otherwise linger open over the capture
          // (reviewer: only the track menus should show)
          { type: 'click', selector: 'button[title="Open track selector"]' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          { type: 'delay', ms: 500 },
          // open the category's "..." track menu (stable testid on the category
          // CascadingMenuButton)
          {
            type: 'click',
            selector: '[data-testid="htsCategoryMenu-Integration test"]',
          },
          { type: 'waitForText', text: 'Add to selection' },
          { type: 'delay', ms: 400 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Add to selection' } },
          // label sits at the arrow's tail and the arrow points from it to the
          // menu item (reviewer: text should be at the end of the arrow)
          {
            type: 'text',
            x: 330,
            y: 150,
            maxWidth: 300,
            text: 'Open a track category menu and click Add to selection',
          },
          {
            type: 'arrow',
            from: { x: 520, y: 185 },
            anchor: { text: 'Add to selection' },
          },
        ],
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
          {
            type: 'text',
            x: 330,
            y: 180,
            maxWidth: 300,
            text: 'Open the selection cart and click Create multi-wiggle track',
          },
          {
            type: 'arrow',
            from: { x: 540, y: 215 },
            anchor: { text: 'Create multi-wiggle track' },
          },
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
    // shorter window — the add-track form is short (reviewer)
    viewportHeight: 620,
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
    // selects "Add multi-wiggle track" and boxes the paste textbox
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
            y: 310,
            text: 'Use this dropdown to reach alternative add-track workflows, e.g. multi-wiggle',
            background: 'rgba(0,0,0,0.8)',
            textColor: '#fff',
            fontSize: 22,
          },
          {
            type: 'arrow',
            from: { x: 880, y: 262 },
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
        // box the paste textbox + a label just to its left with a short arrow
        // into the box (reviewer: the label used to float far from the box; the
        // form hugs the right edge so the label can't sit above it without
        // clipping)
        annotations: [
          {
            type: 'box',
            anchor: { selector: 'textarea[placeholder^="Paste a list"]' },
          },
          {
            type: 'arrow',
            from: { x: 690, y: 250 },
            anchor: { selector: 'textarea[placeholder^="Paste a list"]' },
            dx: -8,
          },
          {
            type: 'text',
            x: 300,
            y: 245,
            text: 'Paste wiggle file URLs here',
            background: 'rgba(0,0,0,0.8)',
            textColor: '#fff',
            fontSize: 26,
          },
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
              displaySnapshot: { type: 'LinearManhattanDisplay', height: 200 },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 60000,
    // shorter Manhattan track (250 -> 200) so the bottom axis + low-score SNPs
    // clear the viewport edge with margin below, instead of sitting flush
    // against it where they read as clipped (reviewer)
    viewportHeight: 410,
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
    // ring the "Tools" top-level menu, box the "Plugin store" menu item, and box
    // the opened Plugin store widget itself (anchored to its "Installed plugins"
    // heading) — reviewer asked to also highlight Tools + the widget
    annotations: [
      { type: 'circle', anchor: { text: 'Tools' } },
      { type: 'box', anchor: { text: 'Plugin store' } },
      { type: 'box', anchor: { text: 'Installed plugins' } },
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
  // Uses the curated MCScan anchor tracks (the same pair the linear_synteny
  // figure uses) rather than the raw grape_peach_paf. A small drag-selection
  // over one diagonal block in the lower-left (peach Pp01 vs grape chr1) launches
  // a legible synteny view instead of the whole-genome criss-cross the reviewer
  // rejected.
  {
    mode: 'url',
    name: 'synteny_from_dotplot_view',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'peach' }, { assembly: 'grape' }],
          tracks: [
            'grape_peach_synteny_mcscan',
            'grape_peach_synteny_mcscan_simple',
          ],
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 60000,
    settleMs: 5000,
    actions: [
      // small rubberband-drag over a single diagonal block in the lower-left
      // (a focused subsection, not the whole region — reviewer; ~75% of the
      // previous drag span, centered on the same block)
      { type: 'drag', from: { x: 126, y: 259 }, to: { x: 224, y: 311 } },
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
                // taller SNPCoverage band + shorter pileup viewport + shorter
                // browser (reviewer): coverageHeight is the LinearAlignmentsDisplay
                // coverage band, the pileup viewport = height - coverageHeight
                coverageHeight: 120,
                height: 420,
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
    viewportHeight: 650,
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
          tracks: [
            'ncbi_gff_hg19',
            {
              trackId: 'hg_isoforms.fasta_bam',
              // taller SNPCoverage band (reviewer): coverageHeight is the
              // LinearAlignmentsDisplay coverage-track height (default 45)
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                coverageHeight: 120,
              },
            },
          ],
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
          loc: 'chr1:1,000,000-1,001,000',
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
      ...menuCascade([
        'Display types',
        'Multi-sample variant display (matrix)',
      ]),
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
      ...menuCascade(['Rendering mode', 'Phased']),
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
    viewportWidth: 1000,
    viewportHeight: 600,
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
      ...menuCascade(['Collapse...', 'Collapse top-level categories'], 300),
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
      ...menuCascade(['Collapse...', 'Collapse subcategories'], 300),
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
    // smaller capture (reviewer) — the import form is compact and centered
    viewportWidth: 1150,
    viewportHeight: 620,
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
    // ring the "Open from track" radio and label it; anchored so the callout
    // tracks the centered form at the reduced viewport width (reviewer). Not
    // made multi-stage: this fresh SvInspectorView has no in-session VCF track,
    // so the "Open from track" dropdown would render empty.
    annotations: [
      { type: 'circle', anchor: { text: 'Open from track' } },
      {
        type: 'text',
        anchor: { text: 'Open from track' },
        dy: -58,
        maxWidth: 320,
        text: 'You can also load SV calls from a VCF track already in the session',
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

  // Standalone ProteinView for BRAF (UniProt P15056). The structure streams from
  // AlphaFold DB and renders on the mol* WebGL canvas (software WebGL via
  // --enable-unsafe-swiftshader is sufficient headless).
  //
  // Loads protein3d from the jbrowse.org plugin-store rehosting's version-
  // agnostic `latest/` UMD (PROTEIN3D_CONFIG) — NOT unpkg, and nothing to bump
  // on a plugin release. `latest/` is served no-cache, so a regen after a
  // `pnpm dep` picks up the newest plugin without the unpkg CDN's stale window.
  {
    mode: 'url',
    name: 'protein/structure',
    url: `?config=${PROTEIN3D_CONFIG}&session=${encodeURIComponent(
      `spec-${JSON.stringify({
        views: [
          {
            type: 'ProteinView',
            url: 'https://alphafold.ebi.ac.uk/files/AF-P15056-F1-model_v6.cif',
          },
        ],
      })}`,
    )}`,
    // ProteinView flips this test-id once the structure is loaded and no
    // pairwise alignment is pending (standalone structures have none), so the
    // load wait is deterministic instead of a fixed delay. settleMs is no longer
    // covering load — it's just a paint beat for molstar's software-WebGL raster
    // at deviceScaleFactor 2, which can lag a frame behind the model state.
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 60000,
    settleMs: 6000,
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
    // Waits for both the structure load and the genome↔structure pairwise
    // alignment to settle (this view has a connected transcript, so the test-id
    // only flips once the alignment is computed). settleMs is the molstar raster
    // paint beat, as in protein/structure.
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 90000,
    settleMs: 6000,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Clustering workflows
  // ────────────────────────────────────────────────────────────────────────

  // Multi-wiggle clustering, two-stage figure over the PUR copy-number panel
  // (1000 Genomes kidd-lab CNV bigWigs, 104 PUR individuals) added to
  // config_demo — a far richer dataset than the synthetic volvox wiggle
  // (reviewer). Shown in multi-row density mode across a wide chr1 window
  // spanning the AMY1 locus (hg38), a classic copy-number-polymorphic region, so
  // the per-individual copy-number differences drive a meaningful clustering.
  // Top frame: the "Cluster by score" dialog open (auto/manual mode, before).
  // Bottom frame: after "Run clustering", the 104 rows are reordered by signal
  // similarity. showTree:false hides the dendrogram (reviewer: only the row
  // reordering matters; a tree wrongly implies phylogeny). Combines the old
  // cluster_dialog + clustered_result into one before/after.
  {
    mode: 'url',
    name: 'multiwig/cluster_dialog',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // reviewer-specified region
          loc: 'chr3:162,275,163-163,360,944',
          tracks: [
            {
              trackId: 'pur_copynumber_1000g',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                height: 420,
                // multi-row density renderer (reviewer): one colored density
                // strip per individual; `defaultRendering` is a config slot, so
                // this flat key routes into the display's configOverrides
                defaultRendering: 'multirowdensity',
                // hide the post-clustering dendrogram — the reordered rows are
                // the point; a tree implies a phylogeny we don't mean (reviewer)
                showTree: false,
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
  if (spec.mode === 'url') {
    if (spec.url.startsWith('http')) {
      // an absolute url is used verbatim — unless it's a localhost capture (a
      // local dev-plugin build, e.g. protein/connected), which has no public
      // equivalent and so can't become a reader-facing live link
      return /^https?:\/\/(localhost|127\.0\.0\.1)\b/.test(spec.url)
        ? undefined
        : spec.url
    } else {
      // a bare `?config=...` captured against the local build opens identically
      // on the public latest instance
      return `${JBROWSE_LATEST}${spec.url}`
    }
  } else {
    return undefined
  }
}

// screenshot name -> live-instance URL (all current specs are url-mode)
export const screenshotLiveUrls: Record<string, string> = Object.fromEntries(
  specs.flatMap(spec => {
    const url = specLiveUrl(spec)
    return url ? [[spec.name, url] as const] : []
  }),
)
