import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { KeyInput } from 'puppeteer'

export interface ScreenshotAction {
  type:
    | 'click'
    | 'rightclick'
    | 'hover'
    | 'type'
    | 'drag'
    | 'scroll'
    | 'waitForText'
    | 'waitForSelector'
    | 'press'
    | 'delay'
  selector?: string
  text?: string
  ms?: number
  // for 'press': a puppeteer keyboard key name (e.g. 'ArrowDown', 'Enter') — used
  // to drive keyboard-only widgets like the MUI search-autocomplete dropdown,
  // which ignores synthetic option clicks
  key?: KeyInput
  // for 'waitForText'/'waitForSelector': wait for the element to be hidden
  hidden?: boolean
  // for 'type': text to type into the focused/selected input
  value?: string
  // for 'type': triple-click the field to select existing content first
  clear?: boolean
  // for 'drag': start/end points in viewport CSS px (used for rubberband drags)
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  // for 'scroll': center the target (selector/text) in its nearest
  // horizontally-scrollable ancestor — e.g. a wide feature bar in a
  // horizontally scrollable alignment track that's otherwise off the right
  // edge
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
  strokeWidth?: number // box/circle stroke width (default 5); arrow line+head (default 4)
  fillOpacity?: number // box: tint the interior with a translucent wash of color
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
  // render this spec with the Firefox backend instead of Chrome. Headless
  // Chrome's swiftshader rasterizes some WebGL/molstar content (e.g. the
  // protein3d structure canvas) as a featureless blob with no visible
  // selection; headless Firefox renders it cleanly. The CLI `--firefox` flag
  // forces every spec onto Firefox; this opts a single spec in for normal regens
  firefox?: boolean
  // per-spec override of the content-stable diff gate (fraction of pixels in
  // [0,1]). Raise it for specs with irreducible render jitter — remote-data
  // timing, heavy text, animated chrome — so an unchanged capture isn't
  // re-committed every regen. Prefer making the capture reproducible first;
  // reach for this only when the jitter can't be designed out. Defaults to the
  // global DEFAULT_DIFF_THRESHOLD.
  diffThreshold?: number
  // crop the capture to this CSS-px rect (ignored by embedded specs, which
  // screenshot the component element directly)
  crop?: { x: number; y: number; width: number; height: number }
}

// Mode 1: navigate to app, interact via UI to open tracks.
// This is the reliable approach — plugins are fully loaded before tracks open.
interface LGVSpec extends CommonSpecFields {
  mode?: 'lgv'
  name: string
  config?: string // defaults to volvox config
  loc?: string // location to navigate to (default: config default)
  openTracks?: string[] // track IDs to click open in the track selector
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
  settleMs?: number
  actions?: ScreenshotAction[]
}

// Mode 3: invoke the @jbrowse/img CLI (jb2export) directly. These produce the
// products/jbrowse-img/README example images — React SSR renders straight to
// SVG/PNG with no browser involved, so they regenerate from plain jb2export
// args instead of the LGV/URL puppeteer machinery, and land in
// products/jbrowse-img/img/ rather than website/static/img/.
export interface CliSpec {
  mode: 'cli'
  name: string // 'jbrowse-img/<basename>'; basename matches the .png in products/jbrowse-img/img/
  args: string[] // jb2export args; the generator appends `--out <tmpfile>`
  curated?: boolean
  diffThreshold?: number
}

// Mode 4: render the embedded `@jbrowse/react-linear-genome-view2` component
// itself (not the jbrowse-web app) via its prebuilt UMD bundle, the exact
// script-tag setup the embed tutorial documents. The generator serves a tiny
// harness page that calls `createViewState(viewState)` and mounts
// `<JBrowseLinearGenomeView>`, then screenshots the component element. Use for
// figures that must show the embedded component rather than the full app.
export interface EmbeddedSpec extends CommonSpecFields {
  mode: 'embedded'
  name: string
  // the object passed verbatim to the UMD's `createViewState(...)` (assembly /
  // tracks / defaultSession / location). Must be plain JSON — it is serialized
  // into the harness page, so no functions / jexl callbacks.
  viewState: object
  readyText?: string // text to wait for before settle (e.g. a track label)
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
  settleMs?: number
}

export type BrowserScreenshotSpec = LGVSpec | SessionUrlSpec | EmbeddedSpec
export type ScreenshotSpec = BrowserScreenshotSpec | CliSpec

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
// HG00151 Oxford Nanopore reads from the 1000 Genomes ONT Sequencing Consortium
// (s3://1000g-ont), minimap2-aligned to hg38. Deliberately the MINIMAP2_ALIGNED_BAMS
// file, NOT the NAPU/PMDV_FINAL.haplotagged.bam — the DeepVariant-haplotagged
// output drops the supplementary (SA-tag) split alignments, so an inversion's
// split reads vanish from it; the minimap2 alignment is the one the consortium's
// SV callers used and where the fwd/rev split at the breakpoint is visible.
// Paired with HG00151's Illumina high-coverage CRAM (HG00151.final, in the KG
// config) for the same-sample short-vs-long inversion figure.
const HG00151_ONT_1000G_BAM =
  'https://1000g-ont.s3.amazonaws.com/PROCESSED_DATA/ALIGNED_TO_HG38/MINIMAP2_ALIGNED_BAMS/HG00151-ONT-hg38-R9-LSK110-guppy-sup-5mC.phased.bam'
const HG00151_ONT_1000G_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG00151_ONT_1000G_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${HG00151_ONT_1000G_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
// NA12878 direct-RNA nanopore reads sliced to just the PTEN locus and re-hosted,
// so the collapse-introns/sashimi figure downloads a ~2 MB deterministic file
// instead of range-querying the whole-genome BAM (which never quiesced before
// the loading-overlay timeout — the source of that figure's run-to-run flakiness).
const PTEN_RNASEQ_BAM =
  'https://jbrowse.org/demos/rnaseq/NA12878-DirectRNA.PTEN.bam'
const PTEN_RNASEQ_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: PTEN_RNASEQ_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${PTEN_RNASEQ_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
const DEMO_CONFIG = 'test_data/config_demo.json'
// hg38 + NCBI RefSeq + ClinVar, loading the Protein3d plugin pinned to a
// specific published version on jsDelivr (not the drifting jbrowse.org `latest/`
// path, which the protein-feature data-testid clicks below depend on). Rendered
// against the *local* build (bare ?config=), which has the workspaces split API
// (setPendingMove) the side-by-side launch needs.
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

// The overwhelmingly common spec shape: a session with a single
// LinearGenomeView. `view` carries the view-level props (assembly/loc/tracks and
// any extras like colorByCDS/trackLabels); `type: 'LinearGenomeView'` is filled
// in. Encodes identically to the hand-written `sessionSpec(cfg, { views: [{ type:
// 'LinearGenomeView', ...view }] })`, so it never changes a rendered image.
function lgvSession(
  config: string,
  view: { assembly: string } & Record<string, unknown>,
) {
  return sessionSpec(config, {
    views: [{ type: 'LinearGenomeView', ...view }],
  })
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

const trackMenuIcon = (trackId: string): ScreenshotAction => ({
  type: 'click',
  selector: `[data-testid="track_menu_icon"][data-trackid="${trackId}"]`,
})

// Open the alignments "Set feature height..." submenu and leave it open.
// CascadingSubmenu opens on click as well as hover (onClick -> onOpen), and a
// click is deterministic where a hover is timing-sensitive (the pileup keeps
// re-laying-out while reads stream, so the hovered row can move out from under
// the cursor). Target the submenu row by its data-testid prefix.
const openFeatureHeightSubmenu = (): ScreenshotAction[] => [
  { type: 'waitForText', text: 'Set feature height' },
  { type: 'delay', ms: 300 },
  {
    type: 'click',
    selector: '[data-testid^="cascading-submenu-set_feature_height"]',
  },
  { type: 'waitForText', text: 'Super-compact' },
  { type: 'delay', ms: 500 },
]

// A stage that ends with its submenu open must be fully dismissed before the
// next stage clicks a different track's menu, or the lingering menu's backdrop
// swallows that click and it lands on the wrong track. Escape does NOT close
// these menus (keyboard focus isn't inside the popover), but the invisible modal
// backdrop does on click — two clicks on a neutral spot (the view title bar)
// pop the submenu then the main menu; then wait for the menu text to be gone.
const dismissMenus = (): ScreenshotAction[] => [
  { type: 'click', from: { x: 550, y: 58 } },
  { type: 'delay', ms: 300 },
  { type: 'click', from: { x: 550, y: 58 } },
  { type: 'waitForText', text: 'Set feature height', hidden: true },
  { type: 'delay', ms: 300 },
]

// ── Trio crossover callouts (analyze_trio.md) ──────────────────────────────
// The six VCF haplotype rows, top→bottom, sharing the hap-ibd painting's
// Father/Mother hapN names so the sidebar and the painting read consistently.
// `name`/`sampleName` keep the canonical "HG020xx HPn" identity; `label` is the
// friendly sidebar text. trioRowY(label) is the CSS-y of that row's top.
const TRIO_HAPLOTYPES = [
  { sample: 'HG02024', hp: 0, label: 'Child hap1' },
  { sample: 'HG02024', hp: 1, label: 'Child hap2' },
  { sample: 'HG02025', hp: 0, label: 'Mother hap1' },
  { sample: 'HG02025', hp: 1, label: 'Mother hap2' },
  { sample: 'HG02026', hp: 0, label: 'Father hap1' },
  { sample: 'HG02026', hp: 1, label: 'Father hap2' },
]
const trioVcfLayout = TRIO_HAPLOTYPES.map(h => ({
  name: `${h.sample} HP${h.hp}`,
  sampleName: h.sample,
  HP: h.hp,
  label: h.label,
}))
// top of Child hap1, just under the painting track. The painting is filtered to
// one parent's 2 haplotype rows, so it's shorter than the old 4-row painting and
// the VCF panel sits ~44px higher (measured; was 320).
const TRIO_VCF_ROW_TOP = 276
// the VCF display auto-fits its `TRIO_VCF_DISPLAY_H` px body across the 6
// haplotype rows (LinearMultiSampleVariantDisplay has no line zone), so the true
// per-row pitch is height/rows ≈ 43.33 — NOT a round 44, which drifts the frames
// ~3px low by the bottom row (reviewer: boxes don't exactly match the rows).
const TRIO_VCF_DISPLAY_H = 260
const TRIO_VCF_ROW_PITCH = TRIO_VCF_DISPLAY_H / TRIO_HAPLOTYPES.length
const trioRowY = (label: string) =>
  TRIO_VCF_ROW_TOP +
  TRIO_VCF_ROW_PITCH * TRIO_HAPLOTYPES.findIndex(h => h.label === label)

// the crossover is centered in the 400 kb window; the genotype canvas spans the
// full ~1500 px view width
const TRIO_XOVER_X = 750
const TRIO_HL_FILL = 0.16 // translucent wash inside each highlight frame
// distinct palettes so the two figures aren't mistaken for each other
const TRIO_MATERNAL_COLORS = { left: '#15a01a', right: '#ff6f00' } // green/orange
const TRIO_PATERNAL_COLORS = { left: '#caa200', right: '#8e44ad' } // yellow/purple

// hap-ibd painting rows, top→bottom: Father hap1, Father hap2, Mother hap1,
// Mother hap2. trioPaintingStep boxes the two rows a crossover steps between
// (the Father pair starts at index 0, the Mother pair at index 2).
const TRIO_PAINT_TOP = 188
const TRIO_PAINT_ROW_H = 32
const trioPaintingStep = (topRow: number) => ({
  type: 'box' as const,
  color: '#333',
  x: 722,
  y: TRIO_PAINT_TOP + topRow * TRIO_PAINT_ROW_H,
  width: 56,
  height: TRIO_PAINT_ROW_H * 2,
})

// Colour-code the two sides of a crossover: the left-colour frame wraps the
// parental copy matched left of the breakpoint plus the matching left half of
// the child row; the right-colour frame wraps the copy matched right of it plus
// the child's right half; each lightly tinted. A neutral box marks the painting
// step and an arrow drops from it to the crossover point on the child row.
function crossoverHighlights(opts: {
  child: string
  leftSource: string
  rightSource: string
  palette: { left: string; right: string }
  paintingTopRow: number
  leftText: string
  rightText: string
}): Annotation[] {
  const { child, leftSource, rightSource, palette } = opts
  const step = trioPaintingStep(opts.paintingTopRow)
  const leftW = TRIO_XOVER_X - 3
  const rightW = 1495 - TRIO_XOVER_X
  const frame = (color: string, x: number, row: string, width: number) =>
    ({
      type: 'box',
      color,
      fillOpacity: TRIO_HL_FILL,
      x,
      y: trioRowY(row),
      width,
      height: TRIO_VCF_ROW_PITCH,
    }) satisfies Annotation
  const caption = (color: string, x: number, text: string) =>
    ({
      type: 'text',
      color,
      x,
      y: trioRowY('Father hap2') + 70,
      text,
      maxWidth: 600,
    }) satisfies Annotation
  return [
    step,
    {
      type: 'arrow',
      // thinner line -> smaller arrowhead (reviewer: head was too big)
      strokeWidth: 2,
      from: { x: TRIO_XOVER_X, y: step.y + step.height },
      to: { x: TRIO_XOVER_X, y: trioRowY(child) },
    },
    frame(palette.left, 3, leftSource, leftW),
    frame(palette.left, 3, child, leftW),
    frame(palette.right, TRIO_XOVER_X, rightSource, rightW),
    frame(palette.right, TRIO_XOVER_X, child, rightW),
    caption(palette.left, 60, opts.leftText),
    caption(palette.right, 800, opts.rightText),
  ]
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

// Thin local config wiring the ce11 assembly + the real UCSC ce11 26-way multiz
// MAF (data hosted on jbrowse.org/demos/ce + UCSC) to the *built-in* MAF
// support. The jbrowse.org/demos/ce config itself loads the old external
// mafviewer UMD plugin, which would shadow the built-in conservation band and
// trip the cross-origin-plugin trust dialog — so a local config path is used to
// render with the local build's code instead.
const CE_MAF = 'test_data/ce_maf.json'

// Same ce11 26-way MAF, plus an `annotationAdapter` sub-adapter (a local bigBed
// built from the real UCSC ce11 multiz26wayFrames data) on the MAF adapter, so
// the per-species CDS reading-frame overlay + codon view render.
const CE_MAF_FRAMES = 'test_data/ce_maf_frames.json'

// UCSC hg38 470-way multiz (Zoonomia + more) config.
const HG38_470WAY = 'test_data/hg38_multiz470way.json'

// A representative ~30-species slice of the hg38 470-way spanning the major
// mammalian clades (primates, rodents+glires, laurasiatheria, afrotheria,
// xenarthra) plus opossum and platypus as marsupial/monotreme outgroups — close
// to the classic UCSC "30-way vertebrate" sampling. Exact leaf names from
// hg38.470way.nh (the Cactus alignment uses HL-prefixed names for many
// assemblies). Used as a `subtreeFilter`; the pruned guide tree then reads as a
// clean ~30-leaf dendrogram instead of the full 470-species tree.
const HG38_470WAY_30 = [
  'hg38', // human
  'panTro6', // chimp
  'gorGor6', // gorilla
  'ponAbe3', // orangutan
  'rheMac10', // rhesus macaque
  'HLcalJac4', // marmoset
  'otoGar3', // bushbaby
  'mm39', // mouse
  'rn6', // rat
  'cavPor3', // guinea pig
  'hetGla2', // naked mole-rat
  'oryCun2', // rabbit
  'tupBel1', // tree shrew
  'bosTau9', // cow
  'HLoviAri5', // sheep
  'susScr11', // pig
  'vicPac2', // alpaca
  'turTru2', // dolphin
  'equCab3', // horse
  'cerSim1', // white rhino
  'felCat9', // cat
  'canFam4', // dog
  'ursMar1', // polar bear
  'myoLuc2', // little brown bat
  'eriEur2', // hedgehog
  'HLloxAfr4', // elephant
  'echTel2', // tenrec
  'oryAfe1', // aardvark
  'dasNov3', // armadillo
  'monDom5', // opossum
  'HLornAna3', // platypus
]

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

// S3-hosted yeast comparison (S. cerevisiae R64 vs the YJM1447 strain), used by
// the dotplot/synteny CliSpecs below.
const YEAST =
  'https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447'

function cliSpec(name: string, args: string[]): CliSpec {
  return { mode: 'cli', name: `jbrowse-img/${name}`, args }
}

const jbrowseImgSpecs: CliSpec[] = [
  // Headline (README "## Screenshot"): a multi-track human view from public
  // files — NCBI RefSeq genes, ClinGen gene-disease, phyloP conservation,
  // SKBR3 nanopore. --aliases reconciles the 1 / chr1 / NC_000001.10 refname
  // styles across files.
  cliSpec('1', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--aliases',
    'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    '--gffgz',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    '--bigbed',
    'https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinGen/clinGenGeneDisease.bb',
    '--bigwig',
    'https://hgdownload.cse.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw',
    '--cram',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram',
    '--loc',
    '1:19,197,000-19,233,000',
    '--width',
    '1200',
  ]),

  // Whole-genome dotplot: every YJM1447 contig (x) vs every R64 contig (y).
  // --autoDiagonalize reorders the R64 contigs so the main alignment forms a
  // clean diagonal instead of a staircase.
  cliSpec('yeast_dotplot', [
    'dotplot',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--fasta2',
    `${YEAST}/r64.fa`,
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--autoDiagonalize',
    '--width',
    '1100',
  ]),

  // Single-chromosome synteny ribbon: YJM1447 chr I vs R64 chr I
  // (NC_001133.9). --drawCurves renders the ribbon as a smooth bezier instead
  // of straight trapezoids.
  cliSpec('yeast_synteny', [
    'synteny',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--loc',
    'I',
    '--fasta2',
    `${YEAST}/r64.fa`,
    '--loc2',
    'NC_001133.9',
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Whole-genome multi-chromosome synteny straight from the CLI (assemblies
  // stack in argv order, the PAF binds to the gap between them). autoDiagonalize
  // reorders grape chromosomes for least overlap; colorBy query tints ribbons by
  // peach chromosome.
  cliSpec('grape_peach_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/peach.chrom.sizes',
    '--paf',
    'https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz',
    '--chromSizes',
    'data/comparative/grape.chrom.sizes',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '350',
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Mammalian-scale: human (hs1) vs mouse (mm39). --minAlignmentLength 500000
  // drops short alignments so the large syntenic blocks stay legible.
  cliSpec('hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--minAlignmentLength',
    '500000',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '350',
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Three-level stack: hg38 / hs1 / mm39 (one ribbon per adjacent pair — a UCSC
  // liftOver chain between each, each placed between the two assemblies it
  // relates).
  cliSpec('hg38_hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hg38.chrom.sizes',
    '--chain',
    'data/comparative/hg38ToHs1.over.chain.gz',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--minAlignmentLength',
    '500000',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '300,300',
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Circular structural-variant chord plot (bundled volvox SV VCF).
  cliSpec('circular_chords', [
    'circular',
    '--fasta',
    'data/volvox/volvox.fa',
    '--vcfgz',
    'data/volvox/volvox.dup.vcf.gz',
    '--width',
    '800',
  ]),

  // Gene/feature track (bundled volvox annotations).
  cliSpec('gene_track', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--gffgz',
    'data/volvox/volvox.sort.gff3.gz',
    '--loc',
    'ctgA:1-50000',
    '--width',
    '1200',
  ]),

  // Hi-C contact matrix: the public hg19 demo .hic streamed from S3. The
  // triangular heatmap shows TAD structure along chr1.
  cliSpec('hic', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--hic',
    'https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic',
    'height:400',
    '--loc',
    '1:2,500,000-12,500,000',
    '--width',
    '1200',
  ]),

  // Dark theme (bundled volvox coverage + annotations).
  cliSpec('dark_theme', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bigwig',
    'data/volvox/volvox-sorted.bam.coverage.bw',
    '--gffgz',
    'data/volvox/volvox.sort.gff3.gz',
    '--loc',
    'ctgA:1-20000',
    '--themeName',
    'darkStock',
    '--width',
    '1200',
  ]),

  // Reference-sequence track zoomed to base level: --refseq shows the DNA
  // bases and the six-frame translation (green start codons, red stops).
  cliSpec('sequence', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--loc',
    'ctgA:108-208',
    '--refseq',
    '--width',
    '1500',
  ]),

  // Plain alignments pileup (bundled volvox BAM).
  cliSpec('alignments_pileup', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // snpcov collapses the alignments display to coverage-only by sizing the
  // coverage band to fill the whole track (no read pileup below).
  cliSpec('alignments_snpcov', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    'snpcov',
    'height:200',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // Reads colored and sorted by their read-group (RG) tag.
  cliSpec('alignments_readgroup', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-rg.bam',
    'color:tag:RG',
    'sort:tag:RG',
    'height:300',
    '--loc',
    'ctgA:1000-2000',
    '--width',
    '1200',
  ]),

  // group:tag:HP splits the pileup into one sub-track per haplotype. HG002
  // ultralong ONT (hg19) streamed from the GIAB FTP; the het deletion sits in
  // one haplotype only.
  cliSpec('alignments_haplotype', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bam',
    'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam',
    'group:tag:HP',
    'color:tag:HP',
    'height:400',
    '--loc',
    '1:63,005,675-63,007,432',
    '--width',
    '1200',
  ]),

  // color:methylation paints per-base CpG calls from a modified-base CRAM.
  // COLO829 nanopore (hg38) over a CpG island; --aliases reconciles the
  // chr20/20 refname styles.
  cliSpec('methylation', [
    '--fasta',
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    '--aliases',
    'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    '--cram',
    'https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram',
    'color:methylation',
    'height:350',
    '--loc',
    '20:18,500,750-18,503,250',
    '--width',
    '1200',
  ]),

  // Variant track (bundled volvox VCF).
  cliSpec('variants', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--vcfgz',
    'data/volvox/volvox.filtered.vcf.gz',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // Multi-sample variant genotype matrix: display:multivariant selects the
  // LinearMultiSampleVariantDisplay for a 1094-sample VCF (volvox.test.vcf.gz,
  // refname contigA reconciled to ctgA via --aliases). Each column is a variant,
  // each row a sample; alt genotypes paint over the reference background.
  //
  // NOTE (screenshot review): the reviewer wants human 1000 Genomes data here.
  // Two blockers make that more than a locus swap, both confirmed by testing:
  //  1. jb2export's static SSR renders the per-sample genotype MATRIX empty for
  //     the 1000 Genomes phase-3 callset even with the data fully loaded locally
  //     and rows at 1px — only volvox's simpler path paints cells. So the
  //     multivariant matrix render needs a jb2export fix first.
  //  2. Even once it paints, real population data is reference-dominant (grey);
  //     the compelling view colors rows by population (colorBy:'population'),
  //     which needs the adapter's samplesTsv — a small jb2export CLI feature
  //     (a samplesTsv: modifier -> samplesTsvLocation) that has to land with it.
  cliSpec('multisample_variants', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--aliases',
    'data/volvox/volvox.aliases.txt',
    '--vcfgz',
    'data/volvox/volvox.test.vcf.gz',
    'display:multivariant',
    'height:500',
    'force:true',
    '--loc',
    'ctgA:2950-4250',
    '--width',
    '1200',
  ]),

  // SKBR3 cell-line whole-genome coverage (hg19, --loc all), log scale — the
  // cancer karyotype's amplifications/deletions stand out.
  cliSpec('skbr3_cov', [
    '--loc',
    'all',
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bigwig',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    'scaletype:log',
    'fill:false',
    'resolution:superfine',
    'height:400',
    'color:purple',
    'minmax:1:1024',
    '--width',
    '1400',
  ]),
]

export const specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_alignments',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'volvox_variants',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:5000-10000',
      tracks: ['volvox_test_vcf'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'variant_with_pileup',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:14439-14515',
      tracks: [
        {
          trackId: 'volvox_filtered_vcf',
          // the variant track is a single row of features, so shrink its
          // band so it doesn't dominate the figure over the pileup (reviewer)
          displaySnapshot: { height: 60 },
        },
        'volvox_cram_alignments',
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  // Multi-sample variant display colored by consequence impact, on REAL data:
  // a small local slice of 1000 Genomes phase 3 chr1 (2,504 real samples,
  // 1:155,000,000-155,050,000) run through real SnpEff 5.4c against the real
  // Ensembl GRCh37.75 database — unlike the volvox spec above, every ANN
  // annotation here is genuine SnpEff output on real genotypes, not
  // hand-crafted. See test_data/1000g_snpeff_chr1/README.md for provenance.
  // The window covers the DCST2/DCST1/ADAM15 locus, which has real
  // stop-gained/splice-site (HIGH) variants alongside missense/synonymous/
  // intronic ones.
  // Clustered so the 2,504 sample rows are reordered by genotype similarity with
  // a dendrogram in the left sidebar (reviewer: "add clustering if it helps") —
  // co-inherited haplotype blocks group into contiguous same-color bands instead
  // of being scattered row-to-row. Clustering is a real RPC over the genotype
  // matrix, so the figure drives the "Cluster by genotype" → "Run clustering"
  // actions rather than setting a (stale) precomputed tree in the snapshot.
  {
    mode: 'url',
    name: 'variants/consequence_impact_1000g',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:155,015,000-155,035,000',
      tracks: [
        {
          trackId: '1000g_chr1_snpeff_consequence',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            height: 500,
          },
        },
      ],
    }),
    readyText: 'chr1',
    settleMs: 8000,
    viewportHeight: 650,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Cluster by genotype' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Cluster by genotype' },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Run clustering' },
      { type: 'waitForText', text: 'Run clustering', hidden: true },
      { type: 'delay', ms: 10000 },
    ],
  },

  // Same feature, on a real structural-variant callset: real HGSVC chr1
  // long-read SV calls (74 real sample/haplotype columns) run through real
  // SnpEff 5.4c against the real Ensembl GRCh38.99 database. This window,
  // chr1:145,250,000-145,450,000, lands on NBPF20 — a member of the NBPF gene
  // cluster, one of the best-documented structural-variation hotspots in the
  // human genome — where SnpEff calls real exon_loss_variant/frameshift_variant
  // (HIGH) consequences against a MODIFIER (intronic/intergenic) background.
  // See test_data/hgsvc_sv_snpeff/README.md for provenance.
  // Clustered (reviewer: the raw insertion glyphs "look kind of chaotic ... may
  // want to add clustering"): running "Cluster by genotype" reorders the 74
  // sample/haplotype rows by SV-genotype similarity and adds a dendrogram, so
  // samples sharing the same structural calls stack into coherent blocks instead
  // of an unordered scatter of insertion triangles. Driven through the real
  // clustering RPC via the menu actions, same as the 1000g spec above.
  {
    mode: 'url',
    name: 'variants/consequence_impact_sv',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // zoomed out to ~450kb (reviewer: "try zooming out more") so the NBPF20
      // cluster's SV calls sit in flanking context rather than filling the
      // window, while keeping the cluster roughly centered
      loc: 'chr1:145,150,000-145,600,000',
      tracks: [
        {
          trackId: 'hgsvc_sv_chr1_snpeff_consequence',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            height: 500,
          },
        },
      ],
    }),
    readyText: 'chr1',
    settleMs: 8000,
    viewportHeight: 650,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Cluster by genotype' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Cluster by genotype' },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Run clustering' },
      { type: 'waitForText', text: 'Run clustering', hidden: true },
      { type: 'delay', ms: 10000 },
    ],
  },

  // Multi-sample variant display colored by population: the 1000 Genomes phase 3
  // chr1 callset (2,504 samples) with a population samples-TSV, so the per-sample
  // rows group/color by the 26 population codes. The track config in
  // config_demo.json sets colorBy: 'population' on its LinearMultiSampleVariantDisplay.
  // Remote NCBI VCF — give it a long ready timeout and settle.
  {
    mode: 'url',
    name: 'variants/population_1000genomes',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:155,000,000-155,050,000',
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
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    settleMs: 18000,
    viewportHeight: 650,
  },

  {
    mode: 'url',
    name: 'bigwig_xyplot',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'bigwig_line',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_line'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  // GC content / GC skew computed on the fly from the reference sequence — the
  // tracks the reference sequence track's "Add GC content track" action builds.
  // Shown whole-genome on H. pylori 26695 (a compact 1.67 Mbp bacterial genome)
  // so the GC skew resolves real replication biology: the (G−C)/(G+C) balance
  // stays predominantly one sign along each replichore and flips at the origin
  // and terminus of replication, drawing the classic two-arm skew profile. Two
  // session GCContentTracks wrap the assembly's sequence (absolute fasta url —
  // session tracks don't inherit the config's baseUri): one in `content` mode
  // (G+C fraction) and one in `skew` mode, both with large overlapping windows
  // to smooth the genome-scale curve.
  {
    mode: 'url',
    name: 'gc_content',
    url: hpyloriUrl({
      sessionTracks: [
        {
          type: 'GCContentTrack',
          trackId: 'gc_content_hpylori',
          name: 'GC content',
          assemblyNames: ['hpylori_26695'],
          adapter: {
            type: 'GCContentAdapter',
            sequenceAdapter: {
              type: 'IndexedFastaAdapter',
              fastaLocation: {
                uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa',
                locationType: 'UriLocation',
              },
              faiLocation: {
                uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa.fai',
                locationType: 'UriLocation',
              },
            },
          },
          displays: [
            {
              type: 'LinearGCContentTrackDisplay',
              displayId: 'gc_content_hpylori-display',
              gcMode: 'content',
              windowSize: 2000,
              windowDelta: 2000,
            },
          ],
        },
        {
          type: 'GCContentTrack',
          trackId: 'gc_skew_hpylori',
          name: 'GC skew',
          assemblyNames: ['hpylori_26695'],
          adapter: {
            type: 'GCContentAdapter',
            sequenceAdapter: {
              type: 'IndexedFastaAdapter',
              fastaLocation: {
                uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa',
                locationType: 'UriLocation',
              },
              faiLocation: {
                uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa.fai',
                locationType: 'UriLocation',
              },
            },
          },
          displays: [
            {
              type: 'LinearGCContentTrackDisplay',
              displayId: 'gc_skew_hpylori-display',
              gcMode: 'skew',
              windowSize: 20000,
              windowDelta: 2000,
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hpylori_26695',
          loc: 'NC_018939.1',
          tracks: ['gc_content_hpylori', 'gc_skew_hpylori'],
        },
      ],
    }),
    readyText: 'GC content',
    readyTimeout: 60000,
    settleMs: 8000,
    // two short tracks; crop off the empty viewport below them
    crop: { x: 0, y: 0, width: 1500, height: 430 },
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
    url: lgvSession(DEMO_CONFIG, {
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
            // plot the per-bin average rather than the default whiskers
            // (min/max/avg) — at whole-genome zoom the avg score reads the
            // copy-number level cleanly without the noise band (reviewer)
            summaryScoreMode: 'avg',
          },
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 15000,
    // tall enough to capture the full open View → Show... submenu in stage 1
    // (reviewer: the menu was cut off at the old 420px height)
    crop: { x: 0, y: 0, width: 1500, height: 560 },
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
          // ring the view (hamburger) menu icon that opens this menu (reviewer)
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          // box the "Show..." parent item plus the sub-item it reveals so the
          // whole menu path reads at a glance (reviewer)
          { type: 'box', anchor: { text: 'Show...' } },
          { type: 'box', anchor: { text: 'Show all regions in assembly' } },
        ],
      },
      {
        // bottom frame: after the click the view spans every chromosome and the
        // scatter coverage resolves whole-genome copy-number structure. Wait on
        // the wiggle canvas's paint-complete testid (canvasDrawn -> -done)
        // instead of a fixed delay so the frame isn't captured blank (reviewer:
        // the old 12s delay sometimes fired before the whole-genome render).
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="wiggle-display-done"]',
          },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },

  {
    // Two-step procedure showing the session-wide feature-height default on
    // alignments tracks. featureHeight/featureSpacing are promotable slots
    // (getConfResolved: track value → session default → schema default), so:
    // (1) both alignments tracks inherit Normal, (2) setting the first track to
    // Compact and choosing "Use ... as the default for alignments tracks"
    // promotes Compact to a session default and the second (un-pinned) track
    // follows via inherit. Each stage leaves the "Set feature height" submenu
    // open and boxes the item clicked.
    mode: 'url',
    name: 'feature_height_default_pin',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1..8,000',
      tracks: [
        'volvox_alignments_pileup_coverage',
        'volvox_cram_alignments_ctga',
      ],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    viewportHeight: 900,
    // alignments pileups keep re-laying-out while reads stream in; wait long
    // enough that the menu geometry is stable before the hover/click sequence
    settleMs: 14000,
    hideTooltip: true,
    stages: [
      {
        // both alignments tracks sit at the default (Normal) height. Leave the
        // "Set feature height" submenu open (no Escape before capture) and box
        // the selected "Normal" radio so the reader sees the control itself.
        actions: [
          trackMenuIcon('volvox_alignments_pileup_coverage'),
          ...openFeatureHeightSubmenu(),
        ],
        annotations: [
          {
            type: 'box',
            anchor: { text: 'Normal' },
            strokeWidth: 3,
            fillOpacity: 0.12,
          },
          {
            type: 'text',
            x: 620,
            y: 34,
            maxWidth: 440,
            fontSize: 15,
            text: '1. Feature height defaults to Normal — both tracks inherit it',
          },
        ],
      },
      {
        // set the first track to Compact, then enable "Use current height by
        // default on all alignments tracks" — the second (un-pinned) track
        // follows via inherit. Re-open the submenu so the now-checked default
        // toggle (the item actually clicked) is visible and boxed.
        actions: [
          ...dismissMenus(),
          trackMenuIcon('volvox_alignments_pileup_coverage'),
          ...openFeatureHeightSubmenu(),
          // exact-text match so "Compact" hits the radio, not a longer label
          {
            type: 'click',
            selector:
              '::-p-xpath(//li[@role="menuitem"][normalize-space(.)="Compact"])',
          },
          { type: 'delay', ms: 300 },
          ...dismissMenus(),
          trackMenuIcon('volvox_alignments_pileup_coverage'),
          ...openFeatureHeightSubmenu(),
          { type: 'click', text: 'as the default for alignments tracks' },
          { type: 'delay', ms: 600 },
          ...dismissMenus(),
          // re-open to display the checkbox now ticked, kept on screen for capture
          trackMenuIcon('volvox_alignments_pileup_coverage'),
          ...openFeatureHeightSubmenu(),
        ],
        annotations: [
          {
            type: 'box',
            anchor: { text: 'as the default for alignments tracks' },
            strokeWidth: 3,
            fillOpacity: 0.12,
          },
          {
            type: 'text',
            x: 620,
            y: 34,
            maxWidth: 440,
            fontSize: 15,
            text: '2. "Use ... as the default" promotes it to a session default — every un-pinned track follows',
          },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'sequence_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20000-20050',
      tracks: ['volvox_refseq'],
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
    url: lgvSession(VOLVOX, {
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
    }),
    readyText: 'ctgA',
    // wider window per reviewer, shorter height to trim empty space below pileup
    viewportWidth: 900,
    viewportHeight: 450,
    settleMs: 4000,
    // soft-clip overhang renders dense per-base sequence letters, far more
    // glyphs per pixel than a typical track-label spec, so sub-pixel
    // glyph-positioning jitter (see DEFAULT_DIFF_THRESHOLD comment) adds up to
    // ~1.5% here instead of ~0.2%
    diffThreshold: 0.02,
  },

  // Read cloud (samplot-style) display on the volvox synthetic-SV CRAM: mates are
  // laid out on the Y axis by the log distance between them, so insertion pairs
  // (drawn pink) separate from background. Each pair renders as two colored
  // squares at the read positions joined by a black connector line (the
  // arcMarker pass; see arc.slang / drawCanvas.ts) — the classic samplot look.
  // Drawn below the coverage band (readConnectionsDown) so the cloud doesn't
  // overlap the coverage histogram. Read arcs in an SV context are shown by the
  // multi-sv-trio spec.
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
                // color the cloud by both insert size and orientation:
                // short-insert pairs always paint pink (overriding orientation,
                // so the insertion-supporting cluster stands out from the grey
                // normal background even though it's RR-oriented), while
                // long-/normal-insert pairs paint by their pair type. The arc
                // palette uses a saturated short-insert pink so the thin cloud
                // lines stay visible.
                arcColorByType: 'insertSizeAndOrientation',
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
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
  // zoomed to base-pair resolution with the reference sequence track above
  // (reviewer). Two stages mirror the how-to: stage 1 opens the view menu with
  // "Color by CDS and draw amino acids" boxed; stage 2 clicks it, so each CDS
  // codon is tinted by its reading frame with the amino acid drawn over it,
  // lined up to the reference codons above.
  {
    mode: 'url',
    name: 'gene_track_color_by_cds',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr17:41,244,000-41,244,120',
      // offset labels so they overlay the tracks (reviewer)
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
          },
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    viewportHeight: 600,
    stages: [
      {
        // top frame: the view (hamburger) menu open, the color-by-CDS toggle
        // ringed + boxed so the one click that enables it reads at a glance
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Color by CDS and draw amino acids']),
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          ...cascadeBoxes(['Color by CDS and draw amino acids']),
        ],
      },
      {
        // bottom frame: after the click each codon is frame-tinted with its
        // amino acid drawn over it, aligned to the reference sequence above
        actions: [
          { type: 'click', text: 'Color by CDS and draw amino acids' },
          { type: 'delay', ms: 5000 },
        ],
      },
    ],
  },

  // Selenoprotein transl_except highlight: GPX1 (hg19 NCBI RefSeq, chr3, minus
  // strand) has one in-frame UGA recoded as selenocysteine via a downstream
  // SECIS element, written as
  // `transl_except=(pos:complement(49395565..49395567),aa:Sec)`. Zoomed to that
  // codon with peptide lettering on, the overridden residue is drawn as `U` on an
  // orange codon background (translExceptColor) instead of the stop it would
  // otherwise be. Exercises parseTranslExcept's handling of NCBI's
  // complement()/accession-prefixed pos syntax on real data.
  {
    mode: 'url',
    name: 'gene_track_selenocysteine',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr3:49,395,505-49,395,625',
      colorByCDS: true,
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
          },
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
  // subfeatureLabels:'overlay' draws each product name on its peptide bar (the
  // matureProteinRegion glyph now emits floating labels like the transcript
  // glyph does).
  {
    mode: 'url',
    name: 'gene_track_mature_peptides',
    url: lgvSession('test_data/enterovirus_d/config.json', {
      assembly: 'GCF_000861205.1',
      loc: 'NC_001430.1:727-7,311',
      // offset labels so they overlay the tracks (reviewer)
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_genes_enterovirus_d',
          // tall enough for the gene row + all 12 stacked mature peptides
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            height: 220,
            subfeatureLabels: 'overlay',
          },
        },
      ],
    }),
    readyText: 'NCBI genes',
    readyTimeout: 30000,
    settleMs: 4000,
    viewportHeight: 360,
  },

  // Collapse introns + RNA-seq sashimi: PTEN (hg38) with the MANE transcript
  // and a direct-RNA nanopore track. Right-clicking the gene and choosing
  // "Collapse introns" reshapes the view to the exons placed side by side; the
  // sashimi arcs from the RNA-seq splice junctions then connect adjacent exons.
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
          loc: 'chr10:87,863,113-87,971,930',
          // offset labels so they overlay the tracks (reviewer)
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              // one clean transcript per gene so the PTEN glyph + label is tidy.
              // The collapse-introns dialog's "Show only this feature" (on by
              // default) isolates the reshaped view to PTEN, dropping the
              // neighboring KLLN fragment — no jexl filter needed.
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
            {
              // PTEN-only sliced RNA-seq BAM (see PTEN_RNASEQ_ADAPTER): a tiny
              // deterministic download, so the sashimi arcs are reliably present
              // at capture. compact pileup so the reads pack tightly (reviewer)
              trackId: 'pten_directrna',
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
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 600,
    hideTooltip: true,
    actions: [
      // `readyText: 'NCBI RefSeq'` matches the track *name*, which appears before
      // the remote GFF finishes loading — so wait for the PTEN label itself to
      // render before acting on it.
      { type: 'waitForText', text: 'PTEN' },
      // right-click the gene's floating-label DOM element (not a raw pixel) —
      // robust and exercises the label's real context-menu affordance
      { type: 'rightclick', text: 'PTEN' },
      { type: 'waitForText', text: 'Collapse introns' },
      { type: 'delay', ms: 600 },
      { type: 'click', text: 'Collapse introns' },
      { type: 'waitForText', text: 'Replace current view' },
      { type: 'delay', ms: 600 },
      { type: 'click', text: 'Replace current view' },
      { type: 'waitForText', text: 'Replace current view', hidden: true },
      // let the reshaped view kick off its refetch, then wait for the (now tiny,
      // sliced) RNA BAM to load so the sashimi arcs are present in the capture
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:1-100,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 8000,
    // smaller capture window in both dimensions (reviewer)
    viewportWidth: 1150,
    viewportHeight: 560,
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

  // Selecting a gene from the search dropdown navigates to it AND boxes the
  // specific matched feature (not just the region). Types "EDEN" into the search
  // box, clicks the EDEN gene option, then waits for the highlight overlay
  // (data-testid="feature-highlight") the canvas display draws once the searched
  // feature resolves against the rendered features.
  {
    mode: 'url',
    name: 'search_feature_highlight',
    // start away from EDEN (1050..9000) so its on-canvas floating label isn't in
    // the DOM — otherwise `click text:'EDEN'` would hit that label instead of the
    // search dropdown option. The capture only shows the post-navigation state.
    // A searched feature auto-pins to a top layout row (layoutPinnedFeatureIdSet),
    // so EDEN sits at the top of the otherwise-dense ctgA:1..10,000 stack.
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:30,000..40,000',
      tracks: ['gff3tabix_genes'],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    // small page margin below the (content-sized) view for the callout, so it
    // points up at the pinned-to-top highlight instead of overlapping the track
    viewportHeight: 470,
    settleMs: 4000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'EDEN',
        clear: true,
      },
      { type: 'waitForText', text: 'EDEN' },
      { type: 'delay', ms: 800 },
      // keyboard-select the first option (the EDEN gene): MUI's autocomplete
      // ignores synthetic option clicks, so ArrowDown highlights it and Enter
      // fires navigation + the search-result-selected extension point
      { type: 'press', key: 'ArrowDown' },
      { type: 'press', key: 'Enter' },
      // wait for navigation to settle and the highlight overlay to resolve
      {
        type: 'waitForSelector',
        selector: '[data-testid="feature-highlight"]',
      },
      { type: 'delay', ms: 1200 },
    ],
    annotations: [
      {
        type: 'arrow',
        from: { x: 510, y: 360 },
        anchor: { selector: '[data-testid="feature-highlight"]' },
      },
      {
        type: 'text',
        text: 'The searched gene is pinned to the top, boxed, and tinted',
        x: 510,
        y: 400,
      },
    ],
  },

  // Rubberband selection on the main scalebar, which pops the "Zoom to region /
  // Get sequence / Copy range / Bookmark region" menu.
  {
    mode: 'url',
    name: 'rubberband',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      // zoomed in toward the soft-clip breakpoint (reviewer request)
      loc: 'ctgA:2670-2730',
      tracks: ['volvox-long-reads-sv-bam'],
    }),
    readyText: 'ctgA',
    // wider + taller per reviewer request so the menu cascade and result-frame
    // pileup both have room
    viewportWidth: 1100,
    viewportHeight: 620,
    settleMs: 4000,
    // result frame renders dense per-base sequence letters in the soft-clip
    // overhang (see alignments_soft_clipped's diffThreshold comment)
    diffThreshold: 0.02,
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1500-2000',
      // short paired reads from volvox-sv (reviewer: more interesting than
      // the big long reads the old capture used)
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 6000,
    hideTooltip: true,
    actions: [
      { type: 'rightclick', from: { x: 400, y: 250 } },
      { type: 'waitForText', text: 'Linear read vs ref' },
      { type: 'delay', ms: 800 },
    ],
    // clarify the action (reviewer: it's unclear this menu comes from
    // right-clicking a read). Caption sits over the pileup just left of the menu
    // with a short arrow at the right-clicked read row (y=250 = the click point);
    // JBrowse intentionally clears the hover shading when the context menu opens,
    // so the arrow stands in for the missing highlight.
    annotations: [
      {
        type: 'text',
        x: 165,
        y: 285,
        maxWidth: 180,
        text: 'Right-click any read to open this menu',
      },
      // start the arrow below the text pill (which spans ~y265-285) so the line
      // doesn't cross the callout box, then point up at the right-clicked read
      { type: 'arrow', from: { x: 300, y: 315 }, to: { x: 392, y: 250 } },
    ],
  },

  // Variant feature-details panel for an SNV, with the per-sample genotype table
  // in the SAMPLES section. The variant has no ID, so its only floating label is
  // the description ("C -> T"); clicking it opens the details panel.
  {
    mode: 'url',
    name: 'variant_panel',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:6257-6305',
      tracks: ['volvox_test_vcf'],
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
    // label the SAMPLES genotype table: pill sits to the left of the SAMPLES
    // header (over the empty area beside the drawer) with an arrow into it
    // (reviewer: text should be to the left of the SAMPLES text)
    annotations: [
      { type: 'box', anchor: { text: 'SAMPLES' } },
      {
        type: 'text',
        anchor: { text: 'SAMPLES' },
        dy: 0,
        dx: -230,
        maxWidth: 200,
        text: 'Per-sample genotypes',
      },
      // head nudged left of the SAMPLES header so the arrow points at it
      // without covering the word (reviewer)
      {
        type: 'arrow',
        from: { x: 720, y: 486 },
        anchor: { text: 'SAMPLES' },
        dx: -60,
      },
    ],
  },

  // The Filter by dialog (SAM flag bitmask editor), opened by driving the track
  // menu. Illustrates the "Filtering reads" section.
  {
    mode: 'url',
    name: 'alignments/filter_dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
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
          alpha: 0.8,
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

  // Multi-way synteny demos for the multiway_synteny.md tutorial. Both load a
  // hosted demo config (whose defaultSession opens the stacked LinearSyntenyView)
  // as a bare ?config= against the local build, since MCScanBlocksAdapter /
  // AllVsAllPAFAdapter are newer than jbrowse.org/code/jb2/latest. Generous
  // timeout/settle: the config pulls remote genomes + a synteny file and
  // autoDiagonalize runs a whole-genome RPC before the canvas settles.
  {
    mode: 'url',
    name: 'multiway_synteny/grape_peach_cacao',
    // Rows peach / cacao / grape. colorBy:'reference' anchors every level on the
    // max-adjacency middle row (cacao, shared by both bands) so a cacao
    // chromosome carries ONE color as it's traced up into peach and down into
    // grape. The top peach-cacao band is a transitive ortholog link (grape is
    // the MCScan reference, so only grape-adjacent pairs are direct); the
    // grape-cacao band is direct. autoDiagonalize reorders/flips each lower axis
    // to follow the one above, so the ribbons run near-diagonal instead of
    // crossing into a hairball. showColorLegend:false hides the floating legend.
    // Mirrors the hosted config's defaultSession init otherwise.
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/grape_peach_cacao/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'peach' },
              { assembly: 'cacao' },
              { assembly: 'grape' },
            ],
            tracks: [['peach_cacao_blocks'], ['grape_cacao_blocks']],
            drawCurves: true,
            colorBy: 'reference',
            autoDiagonalize: true,
            showColorLegend: false,
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },
  {
    mode: 'url',
    name: 'multiway_synteny/ecoli_pangenome',
    // colorBy:'default' (not 'query'): these are single-chromosome strains, so
    // per-query-name coloring paints everything one near-uniform color and adds
    // no signal (reviewer: query-name coloring is only useful with multiple
    // chromosomes). Default red ribbons read cleaner here.
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_pangenome/config.json',
      ),
      {
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              { assembly: 'K12' },
              { assembly: 'Sakai' },
              { assembly: 'CFT073' },
              { assembly: 'NCTC86' },
            ],
            tracks: [
              ['K12_Sakai_ava'],
              ['Sakai_CFT073_ava'],
              ['CFT073_NCTC86_ava'],
            ],
            drawCurves: true,
            colorBy: 'default',
          },
        ],
      },
    ),
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
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
    // autoDiagonalize holds the synteny canvas (and thus synteny_canvas_done)
    // off-screen until the diagonalize RPC lands and the reorder is applied, so
    // the canvas only ever appears in its final diagonalized state. The remote
    // 2bit genomes + S3 PIF make that whole-genome fetch slow, so allow
    // generous headroom.
    readyTimeout: 180000,
    settleMs: 15000,
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
    url: lgvSession(VOLVOX, {
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
    }),
    readyText: 'ctgA',
    // narrower window (reviewer request); the rightclick x below is recomputed
    // for this width — the SNP at ctgA:14481 sits at ~0.51 of the 107bp region
    viewportWidth: 1100,
    // crop each stage to the populated header+pileup so the stacked two-frame
    // figure isn't padded by the empty viewport below (reviewer: shorter window).
    // height 500 gives the right-click context menu breathing room below its last
    // item instead of clipping it at the frame edge (reviewer: menu cut off)
    crop: { x: 0, y: 0, width: 1100, height: 500 },
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
          // call out that the right-click happens on the variant column itself.
          // Anchored just left of the menu's top item so the label sits next to
          // the context menu instead of off in the corner (reviewer)
          {
            type: 'text',
            anchor: { text: 'SNP/Mismatch' },
            // text-anchor is "start", so x is the box's left edge and the label
            // grows rightward — push it well left so its right edge clears the
            // context menu's left edge instead of overlapping it (reviewer)
            dx: -440,
            dy: -30,
            maxWidth: 270,
            text: 'Right-click a mismatch to sort reads by that base',
          },
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      // B2M (plus strand, chr15) — a ubiquitously-expressed housekeeping gene
      // with a single isoform and just 3 introns, so the RNA-seq sashimi arcs
      // are few and clean (GAPDH's many short exons gave "tons of small arcs").
      loc: 'chr15:45,003,000-45,012,000',
      // offset track labels so they overlay the tracks (reviewer)
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // give the gene track room so the B2M model is clearly visible
          // above the sashimi arcs (reviewer: gene track too short to see)
          displaySnapshot: { type: 'LinearBasicDisplay', height: 120 },
        },
        'Pairend_StrandSpecific_51mer_Human_hg19',
      ],
    }),
    readyText: 'B2M',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr8:50,366,343-61,321,733',
      // offset labels so they overlay the tracks (reviewer)
      trackLabels: 'offset',
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
    }),
    readySelector: '[data-testid="hic-display-done"]',
    readyTimeout: 60000,
    settleMs: 10000,
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
    url: lgvSession(DEMO_CONFIG, {
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
            // CpG island annotation first (top) so the left-anchored callout
            // text on the CRAM rows below doesn't cover it (reviewer)
            'cpgisland_ucsc_hg38',
            {
              trackId: 'human_chr20_mod_call_5mC_5hmC_CG_cram_modifications',
              displaySnapshot: {
                colorBy: { type: 'modifications' },
                // lift the fetch-size gate so the CRAM auto-loads headless
                // instead of sitting on the force-load prompt (same mechanism
                // as the smalldel/multisv specs)
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
          ],
        },
      ],
    }),
    readyText: 'CpG',
    readyTimeout: 60000,
    settleMs: 35000,
    // label the two rows (reviewer): top is modifications mode (only called
    // mods, at MM-tag positions); bottom is methylation mode (every CpG on the
    // read inspected, methylated red vs unmethylated blue)
    annotations: [
      {
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram_modifications"]',
        },
        dx: -360,
        dy: -10,
        maxWidth: 360,
        text: 'Color by modifications: called 5mC at MM-tag positions.',
      },
      {
        type: 'text',
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-human_chr20_mod_call_5mC_5hmC_CG_cram"]',
        },
        dx: -360,
        dy: -10,
        maxWidth: 360,
        text: 'Color by methylation: unmethylated CpGs paint blue, surfacing hypomethylated regions like this island.',
      },
    ],
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
    url: lgvSession(DEMO_CONFIG, {
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

  // Phased HG002 ONT reads grouped AND colored by the HP tag (alignments_track.md
  // "Sort, color, and filter by tag"). Replaces a 5-stage menu-walkthrough figure
  // with the single end state: groupBy + colorBy HP splits the pileup into one
  // tinted section per haplotype, so the phased reads read at a glance. Same
  // built-in HP grouping the smalldel figure uses, on the same HG002 ultralong
  // ONT track; userByteSizeLimit lifts the force-load gate, readySelector waits
  // for the pileup canvas to paint.
  {
    mode: 'url',
    name: 'alignments/haplotype',
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
          // tighter window (reviewer) so the per-haplotype split and the phased
          // variant columns read clearly
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                height: 500,
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
    viewportHeight: 700,
    settleMs: 15000,
  },

  // Companion to alignments/haplotype: shows HOW to reach grouping — the track
  // menu opened at "Group by..." with its submenu expanded (reviewer wanted a
  // separate figure for the menu path). Choosing "Group by..." opens a dialog
  // where the tag (e.g. HP) is entered. Same HG002 ONT track; reads load via
  // userByteSizeLimit, then the menu is driven open and the entry boxed.
  {
    mode: 'url',
    name: 'alignments/haplotype_groupby',
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
          loc: '1:63,005,000-63,008,000',
          tracks: [
            {
              trackId: 'hg002_nanopore_hp',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                height: 500,
                userByteSizeLimit: 200_000_000,
                colorBy: { type: 'tag', tag: 'HP' },
              },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 700,
    settleMs: 15000,
    hideTooltip: true,
    // Two-stage figure (reviewer): stage 1 is the menu path (track menu ->
    // Group by... submenu, the inner item boxed); stage 2 is the dialog that item
    // opens, with the Tag dimension chosen and HP entered so the haplotype example
    // is concrete. Reads start colored by HP (colorBy tag HP) in both frames.
    stages: [
      {
        actions: [
          {
            type: 'click',
            selector:
              '[data-testid="track_menu_icon"][data-trackid="hg002_nanopore_hp"]',
          },
          { type: 'waitForText', text: 'Group by...' },
          { type: 'hover', text: 'Group by...' },
          // submenu opened once its items render
          { type: 'waitForText', text: 'Ungroup (this track)' },
          { type: 'delay', ms: 800 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Group by...' } }],
      },
      {
        actions: [
          // both menu items read "Group by..."; the inner (dialog-opening) one
          // renders later in the DOM, so target the last match by XPath
          {
            type: 'click',
            selector:
              '::-p-xpath((//li[@role="menuitem"][normalize-space(.)="Group by..."])[last()])',
          },
          {
            type: 'waitForText',
            text: 'Renders the reads as stacked sections',
          },
          { type: 'delay', ms: 500 },
          // open the dimension dropdown and pick the Tag option (label has parens
          // /commas that break the text pseudo-selector, so match by XPath)
          { type: 'click', selector: '[role="dialog"] [role="combobox"]' },
          { type: 'delay', ms: 400 },
          {
            type: 'click',
            selector:
              '::-p-xpath(//li[@role="option"][starts-with(normalize-space(.),"Tag")])',
          },
          { type: 'delay', ms: 400 },
          {
            type: 'type',
            selector: '[data-testid="group-tag-name-input"]',
            value: 'HP',
          },
          // let the optional "Found values" tag preview resolve
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
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
            // read-connection arcs on each trio member (reviewer): discordant /
            // split pairs arc across the SV breakpoints, so the SV signal that is
            // present (or absent) in child vs parents reads at a glance
            {
              trackId: 'HG02030_trio_slice',
              displaySnapshot: { height: 180, readConnections: 'arc' },
            },
            {
              trackId: 'HG02031_trio_slice',
              displaySnapshot: { height: 180, readConnections: 'arc' },
            },
            {
              trackId: 'HG02032_trio_slice',
              displaySnapshot: { height: 180, readConnections: 'arc' },
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '14:84,871,462-84,871,480',
      tracks: ['breast_cancer_sniffles_hg19_traonly_tabix'],
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
        text: 'Launches a breakpoint split view for the TRA — also in paired-end and long-read feature details.',
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
                {
                  trackId: 'breast_cancer_sniffles_hg19',
                  // drop the megabase-scale inversion calls that span the whole
                  // window so only the junction breakends show (reviewer)
                  displaySnapshot: {
                    type: 'LinearVariantDisplay',
                    jexlFiltersSetting: [
                      "jexl:get(feature,'end')-get(feature,'start') < 100000",
                    ],
                  },
                },
              ],
            },
            {
              assembly: 'hg19',
              loc: '5:137,877,000-137,892,000',
              // bottom panel mirrors the top: variants above reads (so the two
              // pileups sit adjacent across the junction) — reviewer
              tracks: [
                {
                  trackId: 'breast_cancer_sniffles_hg19',
                  displaySnapshot: {
                    type: 'LinearVariantDisplay',
                    jexlFiltersSetting: [
                      "jexl:get(feature,'end')-get(feature,'start') < 100000",
                    ],
                  },
                },
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
    url: lgvSession(VOLVOX, {
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
      // wait for the feature-details widget's lazy chunk to load and populate
      // (a fixed delay races the Suspense fallback and captures an empty
      // "Loading" sidebar); CPX_TYPE is the INFO field the annotation anchors to
      { type: 'waitForText', text: 'CPX_TYPE' },
      { type: 'delay', ms: 1000 },
    ],
    // explain the read evidence, plus a single connector from the "INVdup" callout
    // directly to the CPX_TYPE INFO field in the feature-details sidebar so the
    // annotation and the data it describes are visibly linked (reviewer)
    annotations: [
      {
        // sits in the empty white pileup band (so it doesn't cover the arcs at the
        // top of the pileup — the key INVdup evidence) and at the same height as
        // the CPX_TYPE field, so the connector to it is short
        type: 'text',
        x: 640,
        y: 760,
        text: 'Annotated as "INVdup" (inverted duplication)',
        fontSize: 26,
        maxWidth: 360,
      },
      {
        // tail at the callout's right edge, head anchored on the CPX_TYPE field
        type: 'arrow',
        from: { x: 1015, y: 770 },
        anchor: { text: 'CPX_TYPE' },
      },
      {
        // inversion evidence
        type: 'text',
        x: 60,
        y: 440,
        text: 'Green (LL), navy (RR), and magenta split reads flag the inverted segment.',
        maxWidth: 470,
      },
      {
        // duplication evidence, stacked below with a gap
        type: 'text',
        x: 60,
        y: 610,
        text: 'Elevated coverage and arcs mark the duplicated copy.',
        maxWidth: 470,
      },
    ],
  },

  // Same INVdup locus as inverted_duplication, but with the linked-read *bezier*
  // connection mode (showBezierConnections) over an ordinary pileup instead of
  // coverage-band arcs. Each pair is drawn as a horizontal-tangent oval curve
  // spanning its two mates — the same curve shape BreakpointSplitView's
  // AlignmentConnections draws in a single linear view — so the green LL / blue
  // RR same-orientation pairs of the inverted segment stand out as bundled curves
  // across the locus. "View as pairs" (linkedReads: 'normal') is on (reviewer),
  // so each mate pair collapses onto a single row joined by its bezier curve —
  // the abnormal same-orientation (LL/RR) pairs of the inverted duplication read
  // as a coherent stack of curves instead of scattered singleton pileup rows.
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
                linkedReads: 'normal',
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
        text: 'View as pairs joins each pair with a bezier curve. Green (LL) and navy (RR) same-orientation pairs bundle across the locus; magenta marks split reads crossing the inversion.',
        maxWidth: 520,
      },
    ],
  },

  // Same inversion, short reads vs long reads, in ONE sample (HG00151). The
  // companion to inverted_duplication: that figure shows how short paired-end
  // reads only *infer* an inversion (from discordant pair orientation + a few
  // split reads at the breakpoints). Here a ~1.2 kb pure inversion (HGSV_10047,
  // chr1:197,787,660-197,788,855, called by the 1KGP Illumina ensemble AND by the
  // 1000G-ONT consortium's SV callers) is shown with BOTH technologies:
  //   - HG00151 Illumina high-coverage (short paired-end): the inverted segment
  //     reads as a cluster of same-orientation / split pairs arcing over the two
  //     breakpoints.
  //   - HG00151 Oxford Nanopore (long reads): single reads span the whole inverted
  //     segment, so each crosses both breakpoints and splits into a forward + a
  //     reverse-strand supplementary alignment — the split junctions arc in magenta
  //     (the split-read inversion color), directly reading out the inversion that
  //     short reads can only triangulate.
  // HG00151 is Illumina-genotyped 0/1 here; the ONT reads are the minimap2
  // alignment (supplementary/split reads intact — see HG00151_ONT_1000G_ADAPTER).
  {
    mode: 'url',
    name: 'inversion_long_read',
    url: kgUrl({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG00151_ONT_1000g',
          name: 'HG00151 Nanopore (1000G ONT, minimap2)',
          assemblyNames: ['hg38'],
          adapter: HG00151_ONT_1000G_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:197,786,600-197,789,900',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG00151.final',
              displaySnapshot: {
                // link supplementary alignments (View as pairs): chains each
                // pair + its split segments onto one row, so a paired split read
                // that crosses the inversion junction paints magenta
                linkedReads: 'normal',
                readConnections: 'arc',
                // normal read height (with a tall track) so the chevron read
                // directions on the aberrant/split pairs stay legible
                height: 1000,
                coverageHeight: 70,
                featureHeight: 7,
                colorBy: { type: 'pairOrientation' },
                showLegend: true,
              },
            },
            {
              trackId: 'HG00151_ONT_1000g',
              displaySnapshot: {
                // link supplementary alignments: chains each long read's split
                // segments, so the reverse-strand piece of an inversion-spanning
                // read paints the flipped-strand color (and the junction arcs
                // magenta) instead of an uncolored plain pileup
                linkedReads: 'normal',
                readConnections: 'arc',
                height: 560,
                coverageHeight: 70,
                colorBy: { type: 'pairOrientation' },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG00151 Nanopore',
    readyTimeout: 90000,
    viewportHeight: 1740,
    settleMs: 40000,
    annotations: [
      {
        type: 'text',
        x: 60,
        y: 330,
        text: 'Short reads (Illumina): the inversion is only inferred — aberrant pairs cluster at the breakpoints.',
        maxWidth: 470,
      },
      {
        type: 'text',
        x: 560,
        y: 560,
        text: 'Purple marks split/supplementary alignments that point in opposite directions.',
        maxWidth: 360,
      },
      {
        type: 'arrow',
        from: { x: 600, y: 650 },
        to: { x: 520, y: 845 },
      },
      {
        type: 'text',
        x: 60,
        y: 1300,
        text: 'Long reads (Nanopore): one read spans the inversion — reverse-strand core between forward flanks, magenta arcs at the split junctions.',
        maxWidth: 470,
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
    // box the "Add" menu button (the path's first click) plus the "SV inspector"
    // item it opens (reviewer: circle Add too)
    annotations: [
      { type: 'box', anchor: { text: 'Add' } },
      { type: 'box', anchor: { text: 'SV inspector' } },
    ],
  },

  // The SV-inspector import form with "Open from track" selected. The
  // TrackSelector auto-picks the first importable track (the CNV-calls BED), so
  // open the Tracks dropdown and choose the somatic-stvar SV benchmark VCF
  // instead — which flips File Type to VCF — matching the figure where the VCF
  // is loaded from an in-session track rather than pasted as a URL. Cropped to
  // the centered form.
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_open_from_track',
    url: cgiabUrl({ views: [{ type: 'SvInspectorView' }] }),
    readyText: 'Open from track',
    readyTimeout: 60000,
    settleMs: 3000,
    viewportWidth: 1150,
    // taller so the form + opened Tracks dropdown clear the viewport edge with
    // margin below instead of sitting flush against it (reviewer)
    viewportHeight: 440,
    actions: [
      { type: 'click', text: 'Open from track' },
      { type: 'waitForText', text: 'Tracks' },
      { type: 'delay', ms: 500 },
      // clicking the current selection text opens the Tracks dropdown; pick the
      // stvar VCF (substring match) so File Type switches to VCF
      { type: 'click', text: 'somatic CNV calls' },
      { type: 'waitForText', text: 'somatic-stvar' },
      { type: 'click', text: 'somatic-stvar' },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Open from track' } }],
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
    // The SV_20 row (chr3:139,976,414 -> chr13:114,353,244, the same
    // CHROMOPLEXY junction translocation_breakpoint_split drills into below)
    // is mounted in the DataGrid's virtualization buffer but scrolled below
    // the grid's own internal viewport, so its DOM rect is real but not
    // visible until scrolled into view — hover (which Puppeteer auto-scrolls
    // to) brings it on-screen before the anchor box is measured. The matching
    // chord in the circular plot (data-testid `chord-vcf-19`, confirmed by
    // walking the React fiber tree from the chord path to its `feature`
    // prop) is a 1px stroke among ~160 others with no reliable on-screen
    // anchor (hover can't land on it, and its rendered curve geometry doesn't
    // map cleanly through the circular view's screen transform), so the grid
    // row — which carries the same identity in readable text — is the
    // dependable anchor instead.
    actions: [{ type: 'hover', text: 'SV_20' }],
    annotations: [
      { type: 'box', anchor: { text: 'SV_20' } },
      {
        type: 'text',
        x: 60,
        y: 90,
        text: 'SV_20: the chr3↔chr13 chromoplexy translocation, drilled into below.',
        maxWidth: 420,
      },
    ],
  },

  // The chr3<->chr13 CHROMOPLEXY translocation that the chord in the SV inspector
  // points at — benchmark call SV_20 joins chr3:139,976,414 to chr13:114,353,244.
  // Built declaratively as a BreakpointSplitView (init.views resolves to the two
  // child LGVs after attach), each panel showing the 116x tumor PacBio HiFi reads
  // in Super-compact mode (featureHeight 1 / spacing 0, reviewer).
  // showIntraviewLinks draws the
  // black splines between reads that map partially to each side of the junction.
  // The PacBio BAM is the full 118 GB NCBI ftp-trace file (no rehosted slice
  // exists for this locus), so the ~26 MB BAI index downloads on every fresh-tab
  // capture — hence the long readyTimeout. userByteSizeLimit lifts the fetch-size
  // gate so the reads auto-load headless instead of sitting on a force-load
  // prompt.
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_breakpoint_split',
    url: cgiabUrl({
      views: [
        {
          type: 'BreakpointSplitView',
          // LaunchView-BreakpointSplitView takes the two child panels as a
          // top-level `views` array (loc/assembly/tracks) — it wraps them into
          // the view's transient `init` itself. Same shape as DotplotView /
          // LinearSyntenyView session specs.
          views: [
            {
              loc: 'chr3:139,971,414-139,981,414',
              assembly: 'GRCh38_GIABv3',
              tracks: [
                {
                  trackId:
                    'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
                  displaySnapshot: {
                    featureHeight: 1,
                    featureSpacing: 0,
                    height: 400,
                    userByteSizeLimit: 500_000_000,
                  },
                },
              ],
            },
            {
              loc: 'chr13:114,348,244-114,358,244',
              assembly: 'GRCh38_GIABv3',
              tracks: [
                {
                  trackId:
                    'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
                  displaySnapshot: {
                    featureHeight: 1,
                    featureSpacing: 0,
                    height: 400,
                    userByteSizeLimit: 500_000_000,
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    readyText: 'HG008-T_PacBio',
    readyTimeout: 180000,
    viewportHeight: 900,
    settleMs: 25000,
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
    // crop off the empty viewport below; tall enough for the import form (stage
    // 1) and the resulting whole-genome ruler (stage 2)
    crop: { x: 0, y: 0, width: 1500, height: 250 },
    // two-stage (reviewer): stage 1 boxes the "Show all regions in assembly"
    // button on the import form; stage 2 clicks it so the result — every
    // chromosome laid out across the view — shows next
    stages: [
      {
        annotations: [
          { type: 'box', anchor: { text: 'Show all regions in assembly' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          { type: 'delay', ms: 8000 },
        ],
      },
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
      sessionTracks: [
        // hg38 NCBI RefSeq genes (chr-named, CSI-indexed) so the LGV below the
        // inspector shows CUZD1's gene model over the deletion (reviewer)
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
      ],
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          // shorter inspector so the LGV below gets more room (reviewer: not so
          // tall)
          height: 420,
          uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,823,828-122,852,611',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
          ],
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
    // Pared down to the single core narrative (reviewer: too many annotations):
    // search SV_85 -> one DEL row -> clicking its location link opens the region
    // below, where SVTYPE=DEL is drawn as the <DEL> ALT allele on the variant.
    annotations: [
      {
        type: 'text',
        text: 'Searching "SV_85" filters to one DEL (a het CUZD1 deletion)',
        x: 70,
        y: 180,
        fontSize: 18,
        maxWidth: 420,
      },
      { type: 'box', anchor: { text: 'chr10:122,835,344..122,837,142' } },
      { type: 'arrow', from: { x: 185, y: 268 }, to: { x: 598, y: 700 } },
      { type: 'box', x: 592, y: 700, width: 112, height: 52 },
      {
        type: 'text',
        text: 'The location link opens the region below, where SVTYPE=DEL draws as the <DEL> allele',
        x: 745,
        y: 690,
        fontSize: 18,
        maxWidth: 360,
      },
    ],
    // remote VCF over the NCBI ftp-trace server: render timing jitters the
    // circular overview slightly, so soften the content-stable diff gate
    diffThreshold: 0.02,
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

  // The normalized CNV signal built in the "Build CNV tracks" tutorial section:
  // a single log2(tumor/normal) coverage ratio bigWig across all chromosomes,
  // over the benchmark CNV BED. Unlike the two independently-median-normalized
  // indexcov tracks above, one log2-ratio track reads directly as copy number
  // (0 = the genome-wide median, + = gain, - = loss) so gains/losses line up
  // with the called intervals without eyeballing two bands. Domain capped to a
  // symmetric -2..2 so gains/losses read around the 0 line.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_log2ratio_genome',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
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
          trackLabels: 'offset',
          loc: 'chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chr22 chrX chrY',
          tracks: [
            {
              // raw normalized coverage (median≈1 → copy number) for both
              // samples in one band, the signal log2(tumor/normal) is built from
              trackId: 'hg008_cnv_indexcov',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multiscatter',
                resolution: 10,
                minScore: 0,
                maxScore: 2.5,
                height: 160,
              },
            },
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // scatter of the per-bin average (not the default filled/whisker
                // xyplot) reads copy-number gains/losses as a clean point band,
                // the conventional CNV depth-ratio plot. useBicolor:false keeps it
                // a single color: gains/losses read off the 0 line by position, so
                // red/blue stays free to mean tumor/normal on the indexcov track
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                // request bigwig bins 10x finer than screen resolution so the
                // whole-genome scatter resolves the per-bin CNV signal
                resolution: 10,
                minScore: -2,
                maxScore: 2,
                height: 160,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF as a fine-resolution scatter preserving the
                // per-bin spread: LOH arms split into symmetric upper/lower
                // bands off the central 0.5 het line, balanced regions stay a
                // single 0.5 line. resolution:10 keeps bins small enough that
                // the split survives at genome scale.
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 120,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 860,
    settleMs: 25000,
  },

  // The conventional two-panel somatic-CNV view over chromosome 3: log2 ratio
  // (copy number) above the raw 0..1 B-allele frequency (allelic state), with the
  // benchmark CNV calls below. chr3 is a clean teaching example — the p-arm is a
  // single-copy loss WITH loss-of-heterozygosity (negative log2 AND the BAF het
  // SNPs splitting into upper/lower bands off 0.5), while the q-arm is balanced
  // (log2 back up, BAF a single 0.5 line).
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_log2_baf',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3',
          tracks: [
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // scatter of the per-bin average — the conventional CNV depth-
                // ratio plot (see cnv_log2ratio_genome). Single color
                // (useBicolor:false); gains/losses read off the 0 line
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                minScore: -2,
                maxScore: 2,
                height: 140,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF scatter: the p-arm LOH splits het SNPs into an
                // upper and lower band off the 0.5 het line, while the balanced
                // q-arm stays a single 0.5 line. resolution:10 pulls finer
                // bigwig bins so the band-split survives at chromosome scale.
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 560,
    settleMs: 30000,
  },

  // CDKN2A focal homozygous deletion (chr9:21,952,497-21,972,343, benchmark
  // SV_75, total CN=0 / hap 0+0) — the canonical PDAC two-hit tumor-suppressor
  // loss. A homozygous deletion reads differently from a heterozygous (single-
  // copy) loss: depth drops to the floor (both parental copies gone), whereas
  // a het loss only halves depth. The deletion is punched into a larger
  // single-copy-loss arm (CN=1), so it shows as a deeper focal dip. True
  // per-base tumor coverage (mosdepth on a targeted BAM slice, not the 500bp-
  // binned log2 ratio) resolves the ~20kb event's boundaries almost exactly:
  // depth drops from ~65x to precisely 0 at chr9:21,952,497-21,972,343. Shown
  // over NCBI RefSeq genes (the config's hg38_ncbiRefSeq_ucsc, compact for
  // CDKN2A context), the raw HG008-T long-read pileup with supplementary
  // alignments linked (the deletion is a clean drop-out in the reads
  // themselves), and the CN-labeled benchmark CNV track (the config's
  // hg008_cnv_calls) whose label reads out the called copy number (CN 0). The
  // coarse log2 ratio was dropped (reviewer: it duplicates the per-base
  // coverage without adding scale context at this zoom).
  {
    mode: 'url',
    name: 'sv_cgiab/driver_cdkn2a_deletion',
    url: cgiabUrl({
      sessionTracks: [
        {
          // true per-base depth from mosdepth on a targeted BAM slice around
          // CDKN2A (not genome-wide — see WAKHAN-PIPELINE.md step 5) — fine
          // enough to resolve the ~20kb deletion's boundaries, sharper than the
          // 500bp-binned log2 ratio below
          type: 'QuantitativeTrack',
          trackId: 'hg008_t_coverage_finescale',
          name: 'HG008-T fine-scale coverage (per-base)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_coverage_perbase.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          // Tumor PacBio-HiFi reads, re-declared inline so fetchSizeLimit can be
          // raised — the default 5 MB limit blocks the ~116x pileup at this scale
          type: 'AlignmentsTrack',
          trackId: 'hg008_t_reads_cdkn2a',
          name: 'HG008-T PacBio HiFi reads',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            fetchSizeLimit: 30_000_000,
            bamLocation: {
              uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam.bai',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          // ~60kb around the deletion: tight enough that the ~116x read pileup
          // loads (vs the whole ±60kb overview) while still showing CDKN2A and
          // flanking single-copy-loss context
          loc: 'chr9:21,930,000-21,990,000',
          // offset track labels onto their own line so the long track names
          // (fine-scale coverage / PacBio HiFi reads) don't overlap the data
          // (reviewer)
          trackLabels: 'offset',
          tracks: [
            {
              // genes compact so the RefSeq isoforms collapse to a thin band
              // rather than dominating the figure (reviewer)
              trackId: 'hg38_ncbiRefSeq_ucsc',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                displayMode: 'compact',
              },
            },
            {
              trackId: 'hg008_t_coverage_finescale',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                minScore: 0,
                maxScore: 100,
                height: 200,
              },
            },
            {
              // raw long-read pileup (reviewer): the homozygous deletion is a
              // clean read drop-out. linkedReads:'normal' chains each read's
              // supplementary/split alignments onto one row joined by a
              // connector (reviewer: "add view as pairs / link supplementary
              // reads") so reads spanning the deletion breakpoints read as
              // coherent split alignments
              trackId: 'hg008_t_reads_cdkn2a',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                linkedReads: 'normal',
                // compact pileup (reviewer): featureHeight 3 / spacing 0 packs
                // the ~116x pileup so the deletion drop-out reads as a whole
                // rather than scrolling off the display height
                featureHeight: 3,
                featureSpacing: 0,
                height: 320,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr9',
    readyTimeout: 120000,
    viewportWidth: 1500,
    viewportHeight: 1040,
    settleMs: 30000,
  },

  // chr17 as the log2xBAF decision-table teacher. One chromosome shows two
  // distinct LOH mechanisms: 17p is a single-copy loss WITH LOH (CN=1, hap 1+0,
  // covering TP53) — negative log2 AND a BAF split; 17q is COPY-NEUTRAL LOH
  // (CN=2, hap 2+0, ~43Mb) — flat log2 at 0 but a full BAF split. The 17q event
  // is invisible to depth alone; only the BAF reveals it, which is the whole
  // argument for pairing the two tracks.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_chr17_loh',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          // raw normal-vs-tumor coverage overlaid in one band (reviewer: show
          // the multiwiggle of normal vs tumor coverage). indexcov is each
          // sample median-normalized to ~1, so a copy loss reads as the tumor
          // band dropping below the normal band.
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
          loc: 'chr17',
          tracks: [
            {
              trackId: 'hg008_cnv_indexcov',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multiscatter',
                resolution: 10,
                minScore: 0,
                maxScore: 2.5,
                height: 140,
              },
            },
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                // finer bins so the many small CNVs on chr17 resolve at
                // whole-chromosome scale (reviewer)
                resolution: 10,
                minScore: -2,
                maxScore: 2,
                height: 140,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr17',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // taller: gene/CNV context + three wiggle bands (indexcov, log2, BAF)
    viewportHeight: 820,
    settleMs: 30000,
  },

  // KRAS, the central PDAC oncogene: a low-level allelic gain (CN 3, 2+1) on
  // chr12 — positive log2 ratio with an imbalanced (but not fully split) BAF,
  // the fourth entry in the log2xBAF decision table (driver_chr17_loh). The raw
  // 0..1 BAF resolves the 2+1 imbalance: het SNPs split into an upper (~0.67) and
  // lower (~0.33) band rather than the single 0.5 line of a balanced region.
  // A compact NCBI RefSeq gene track (hg38_ncbiRefSeq_ucsc, from the cgiab
  // config) anchors KRAS in the gained arm, and the CN-labeled benchmark CNV
  // track (hg008_cnv_calls, also from the config) reads the opaque "SV_101" id
  // out as its copy number (reviewer: the bare SV id doesn't clarify the
  // event). Zoomed out from 3.5Mb so the gain sits in flanking context.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_kras_gain',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr12:23,000,000-27,500,000',
          // highlight band over the KRAS locus so the eye lands on the oncogene
          // within the ~4.5Mb gained arm even though the gene is tiny at this
          // scale (reviewer: "can't see KRAS gene ... interesting if highlighted")
          highlight: ['chr12:25,205,246-25,250,936'],
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              displaySnapshot: {
                // normal (not compact) height so the KRAS gene row + label read
                // where they land under the highlight band (reviewer: taller track)
                type: 'LinearBasicDisplay',
                height: 150,
              },
            },
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 3,
                minScore: -2,
                maxScore: 2,
                height: 140,
                // request bigwig bins 10x finer than screen resolution so the
                // 500bp-binned log2 signal resolves at this window rather than
                // being served as a coarse bigwig zoom level
                resolution: 10,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF scatter with default whisker summary preserving the
                // per-bin spread; resolution:10 makes it fine-grained so the 2+1
                // gain's band-split is legible
                defaultRendering: 'scatter',
                scatterPointSize: 2,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr12',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // tall enough for the gene track + both wiggles + the CN-labeled CNV calls
    // track to all fit (the gene track pushes the CNV calls down)
    viewportHeight: 780,
    settleMs: 20000,
  },

  // SMAD4 (DPC4), the mirror image of the TP53 event: 18q loss with LOH
  // (CN 1, 0+1) — negative log2 AND the BAF het SNPs splitting off the 0.5 line.
  // The CNV calls use the config's CN-labeled hg008_cnv_calls track so the 18q
  // event reads out as its copy number + haplotype split (reviewer: the bare
  // draftbenchmark SV ids don't say what the call is).
  {
    mode: 'url',
    name: 'sv_cgiab/driver_smad4_loh',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr18:1-80,373,285',
          tracks: [
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                minScore: -2,
                maxScore: 2,
                height: 140,
                // pull finer bigwig bins than the default zoom level so the
                // 500bp-binned log2 signal shows across this whole-chr18 view
                resolution: 10,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF scatter: the 18q LOH splits het SNPs into upper
                // and lower bands off the 0.5 het line. resolution:10 keeps bins
                // fine enough that the split reads at chromosome scale.
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 520,
    settleMs: 20000,
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

  // The dotplot import form with HG008T.hap1 on one axis and GRCh38 on the other
  // (tutorial caption). An empty DotplotView (views:[{},{}]) shows the form; both
  // selectors default to the config's first assembly (GRCh38_GIABv3), so open the
  // first (x-axis) selector and pick HG008T.hap1. Replaces a stale hand-made
  // capture that showed unrelated generic assembly names. Selecting via the UI
  // (not pre-setting assemblies in the snapshot) keeps the form open — pre-set
  // assemblies auto-launch the view.
  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_import_form',
    url: cgiabUrl({ views: [{ type: 'DotplotView', views: [{}, {}] }] }),
    readyText: 'Select assemblies for dotplot view',
    readyTimeout: 60000,
    settleMs: 3000,
    viewportWidth: 1500,
    // tall enough to include the optional synteny-track row below the assembly
    // selectors and the full wrapped helper text
    viewportHeight: 400,
    actions: [
      // both selectors show GRCh38_GIABv3; the first match is the x-axis one —
      // open it and switch to HG008T.hap1. Let the menu's open animation settle
      // before clicking the item, else the click misses mid-transition.
      { type: 'click', text: 'GRCh38_GIABv3' },
      { type: 'waitForText', text: 'HG008T.hap1' },
      { type: 'delay', ms: 600 },
      // target the MUI Select option by data-value (reliable vs a text click
      // that can land on the backdrop during the menu transition)
      { type: 'click', selector: 'li[data-value="HG008T.hap1"]' },
      { type: 'delay', ms: 1000 },
    ],
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
  // Gene feature-details sequence panel on a human gene (reviewer asked for a
  // human example over the volvox EDEN one + a demo of the transl_except
  // functionality, split below into feature_detail_protein). SELENOP
  // (selenoprotein P, chr5, minus strand) is used for both: here the type
  // selector is set to "Genomic w/ full introns +/-" so the panel shows the
  // upstream flank, exons/introns, UTR, and downstream flank color-coded.
  //
  // Uses config_demo's hg38 + ncbi_refseq_109_hg38_latest (labels by gene
  // symbol and exposes real CDS subfeatures, unlike the hg19 ncbi_gff / Gencode
  // tracks the earlier FAF1 attempt tried). geneGlyphMode 'longestCoding' draws a
  // single transcript so the coordinate click lands unambiguously on the MANE
  // mRNA row (canvas-drawn glyphs have no DOM label to target by text).
  {
    mode: 'url',
    name: 'feature_detail_sequence',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:42,799,000-42,812,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
            height: 200,
          },
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 900,
    actions: [
      // Coordinate click on the single MANE transcript row (canvas glyph, no DOM
      // label) — lands on a CDS exon of the SELENOP transcript line, below the
      // CCDC152 neighbor gene above it.
      { type: 'click', from: { x: 637, y: 211 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      // partial (collapsed) introns keep 10bp of each intron so the exon
      // structure reads without huge intronic runs dominating the sequence.
      // exact xpath so it doesn't also match the "+/- up+down stream" variant
      {
        type: 'click',
        selector: '[data-testid="sequence_type_gene_collapsed_intron"]',
      },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Protein translation of SELENOP showing translation exceptions: the ten
  // in-frame UGA stop codons that NCBI RefSeq annotates as
  // `transl_except=(...,aa:Sec)` translate to selenocysteine (U), highlighted
  // amber in the peptide with a legend noting "10 selenocysteines (U) from
  // transl_except". Same setup/transcript click as feature_detail_sequence; only
  // the type selector differs (Protein).
  {
    mode: 'url',
    name: 'feature_detail_protein',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:42,799,000-42,812,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
            height: 200,
          },
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 900,
    actions: [
      { type: 'click', from: { x: 637, y: 211 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Protein' },
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    // Each label sits in the clear band immediately next to the control it names,
    // with a SHORT arrow into it (reviewer: minimize arrow length, place text next
    // to its target, don't pile every pill at the top). Three tiers track the
    // three real control rows: the dark app bar (Add), the clear strip just above
    // the navigation toolbar (track selector / pan / search / zoom, controls at
    // y~122), and the ruler strip just above the track header (drag handle + track
    // menu, controls at y~178). Arrow heads are anchored so they track the real
    // element; pill/tail coords are absolute viewport CSS px (1500x800 capture)
    // tuned to the live control positions. Scroll-to-zoom has its own figure
    // (scroll_zoom_toggle) just above this in the docs, so it's omitted here.
    annotations: [
      // app-bar tier: Add menu (control at ~108,24)
      { type: 'text', text: 'Add view', x: 160, y: 28, fontSize: 16 },
      { type: 'arrow', from: { x: 156, y: 24 }, anchor: { text: 'Add' } },

      // toolbar tier: labels in the clear strip at y~62, short arrows down into
      // the navigation controls at y~122
      {
        type: 'text',
        text: 'Open track selector',
        x: 22,
        y: 62,
        fontSize: 16,
      },
      {
        type: 'arrow',
        from: { x: 40, y: 70 },
        anchor: { selector: 'button[title="Open track selector"]' },
      },
      { type: 'text', text: 'Pan', x: 545, y: 62, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 560, y: 70 },
        anchor: { selector: 'button[aria-label="Pan left"]' },
      },
      { type: 'text', text: 'Search box', x: 690, y: 62, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 730, y: 70 },
        anchor: { selector: 'input[placeholder="Search for location"]' },
      },
      { type: 'text', text: 'Zoom', x: 968, y: 62, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 990, y: 70 },
        anchor: { selector: '[data-testid="zoom_in"]' },
      },

      // ruler tier: labels in the strip at y~152, short arrows down into the
      // track-header controls at y~178
      {
        type: 'text',
        text: 'Drag to reorder track',
        x: 40,
        y: 152,
        fontSize: 16,
      },
      {
        type: 'arrow',
        from: { x: 44, y: 160 },
        anchor: { selector: '[data-testid^="dragHandle-"]' },
      },
      { type: 'text', text: 'Track menu', x: 360, y: 152, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 360, y: 160 },
        anchor: { selector: '[data-testid="track_menu_icon"]' },
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:1,000,000-1,100,000',
      tracks: ['ncbi_gff_hg19'],
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
      // arrow from the "Open track..." menu item to the "Enter track data"
      // heading of the panel it opens; head nudged left so it stops short of
      // the field instead of pointing into the middle of the widget (reviewer)
      {
        type: 'arrow',
        from: { x: 222, y: 262 },
        anchor: { text: 'Enter track data' },
        dx: -30,
      },
    ],
  },

  // Track selector open with the add-track FAB clicked; its menu now opens above
  // the FAB (HierarchicalFab anchorOrigin) so the FAB stays visible (reviewer:
  // the popover used to cover the FAB).
  {
    mode: 'url',
    name: 'add_track_tracklist',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    // smaller browser in both stages (reviewer: reduce figure width/height)
    viewportWidth: 1000,
    viewportHeight: 600,
    readyText: 'ctgA',
    settleMs: 3000,
    // two-stage: the top frame circles the track-selector icon in the LGV header
    // (reviewer: circle the header "tracklist" icon, not the view menu); the
    // bottom frame opens that selector, rings the add-track FAB, and boxes the
    // menu it launches
    stages: [
      {
        actions: [{ type: 'delay', ms: 300 }],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: 'button[value="track_select"]' },
          },
        ],
      },
      {
        actions: [
          { type: 'click', selector: 'button[value="track_select"]' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          { type: 'delay', ms: 500 },
          // open the add-track FAB menu (reviewer: show the menu the FAB
          // launches, not just a ring around the button)
          {
            type: 'click',
            selector: '[data-testid="hierarchical-add-track-fab"]',
          },
          { type: 'waitForText', text: 'Add track' },
          { type: 'delay', ms: 600 },
        ],
        annotations: [
          // a snug ring on the FAB (reviewer: no arrow — the previous arrow cut
          // across the "Add track" box; the ring alone is clear enough)
          {
            type: 'circle',
            anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
          },
          { type: 'box', anchor: { text: 'Add track' } },
        ],
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_sv_test'],
    }),
    viewportWidth: 1000,
    // shorter browser in both stages (reviewer)
    viewportHeight: 500,
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
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

  // Track settings: two-stage figure — top frame opens the track menu's "Track
  // actions" → "Settings" path (boxed); bottom frame clicks it so the Settings
  // sidebar (ConfigurationEditor) is open (reviewer). Uses volvox-bam instead of
  // the gff3 track (reviewer). Any track's settings can now be edited directly
  // (a non-admin's edits are saved as a session override).
  {
    mode: 'url',
    name: 'edit_track_settings',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // shorter browser in each stage (reviewer)
    viewportHeight: 640,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Track actions', 'Settings']),
        ],
        // box the "Track actions" parent submenu and the "Settings" item
        annotations: cascadeBoxes(['Track actions', 'Settings']),
      },
      {
        // click Settings so the ConfigurationEditor sidebar opens
        actions: [
          { type: 'click', text: 'Settings' },
          { type: 'waitForText', text: 'Filter options' },
          { type: 'delay', ms: 1000 },
        ],
      },
    ],
  },

  // Drawer widget position, two-stage figure. Top frame opens the drawer's
  // position menu (MoreVert in the drawer header) with the menu trigger ringed
  // and the "left" option boxed; bottom frame clicks "left" so the drawer moves
  // to the left side of the screen.
  {
    mode: 'url',
    name: 'drawer_widget_toggle',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
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
          // boxed "left" option. Head is nudged left of the word so it points at
          // the item without covering the "left" label text (reviewer).
          {
            type: 'arrow',
            from: { x: 560, y: 230 },
            anchor: { text: 'left' },
            dx: -55,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'left' },
          { type: 'delay', ms: 1500 },
        ],
        // ring the track selector now docked on the left so the reader sees
        // where the drawer moved to (reviewer)
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="drawer-widget"]' },
          },
        ],
      },
    ],
  },

  // Share session dialog, opened from the Share button in the app header.
  {
    mode: 'url',
    name: 'share_button',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr10:89,613,000-89,740,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    // shorter viewport so both stacked panels stay tight (reviewer)
    viewportHeight: 440,
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:1-20,000',
      tracks: ['ncbi_gff_hg19'],
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
    // moved down + right and given an arrow pointing up at the "my region"
    // label input (reviewer)
    annotations: [
      {
        type: 'text',
        text: 'Single-click the label to edit it',
        anchor: { text: 'Bookmark link' },
        dx: -190,
        dy: 170,
        maxWidth: 230,
      },
      { type: 'arrow', from: { x: 1230, y: 275 }, to: { x: 1385, y: 168 } },
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
    url: lgvSession(DEMO_CONFIG, {
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_cram'],
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
        // box only the "Show read arcs" checkbox (reviewer: this figure is
        // specifically about enabling read arcs)
        annotations: [{ type: 'box', anchor: { text: 'Show read arcs' } }],
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
    url: lgvSession(DEMO_CONFIG, {
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
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 35000,
    // colorBy:modifications is set declaratively so the mod data is already
    // loaded and painted by the time the menu opens. Then drive the live Color
    // by → Color by modification type → All modification types path so the
    // figure shows the menu route, not just the result (reviewer asked to
    // actually open the menu). "Color by modification type" / "Color by
    // methylation" are now promoted directly under "Color by..." rather than
    // nested under a "Base modifications (MM tag)" parent. The selector is
    // scoped by data-trackid to the COLO829 alignments track — the bare
    // track_menu_icon matched the CpG-island feature track first, whose Color by
    // menu has no modifications options.
    actions: [
      {
        type: 'click',
        selector:
          '[data-testid="track_menu_icon"][data-trackid="COLO829_tumor.ht"]',
      },
      ...menuCascade(
        ['Color by...', 'Color by modification type', 'All modification types'],
        800,
      ),
    ],
    annotations: cascadeBoxes([
      'Color by...',
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      // no track opened — the figure is about the track-selector hamburger
      // menu, and an open gene track in the LGV behind it was distracting
      // (reviewer)
      tracks: [],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      // open the track selector directly via the header button so the LGV view
      // menu never opens (reviewer: the view menu was left open in the capture)
      { type: 'click', selector: 'button[title="Open track selector"]' },
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:1-100,000',
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
      { type: 'click', text: 'NCBI RefSeq w/ top-level feature details' },
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
      { type: 'waitForText', text: 'NCBI RefSeq w/ top-level feature details' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [
      // ring just the recently-used trigger icon; the popover box was removed
      // (reviewer)
      {
        type: 'circle',
        anchor: { selector: '[data-testid="recently-used-tracks-button"]' },
      },
    ],
  },

  // Favorite tracks: two-stage figure. Top frame boxes the per-track menu's
  // "Add to favorites" item; bottom frame opens the resulting Favorites dropdown
  // with a ring around the Favorites (star) button.
  {
    mode: 'url',
    name: 'favorite_tracks',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
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

  // MultiWig track menu showing the plot type submenu.
  {
    mode: 'url',
    name: 'multiwig/multi_renderer_types',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_multi'],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Plot type', 'Multi-row XY plot']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Plot type' } }],
  },

  // multiquantitative_track.md: the track-selector selection workflow for
  // building a multi-wiggle. Two stacked frames: (1) a category's "..." menu
  // with "Add to selection" boxed, (2) after adding the category, the shopping
  // cart's "Create multi-wiggle track" item boxed.
  {
    mode: 'url',
    name: 'multiwig/trackselector',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
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
        // box the menu item and put the caption over the empty LGV area to its
        // left; no arrow (reviewer: arrows covered up the menu-item text)
        annotations: [
          { type: 'box', anchor: { text: 'Add to selection' } },
          {
            type: 'text',
            x: 60,
            y: 330,
            maxWidth: 300,
            text: 'Open a track category menu and click Add to selection',
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
            x: 60,
            y: 330,
            maxWidth: 300,
            text: 'Open the selection cart and click Create multi-wiggle track',
          },
        ],
      },
    ],
  },

  // Add track dialog showing the multi-wiggle workflow selector.
  {
    mode: 'url',
    name: 'multiwig/addtrack',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
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
            text: 'This dropdown reaches other add-track workflows, e.g. multi-wiggle',
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
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2',
      tracks: [
        {
          trackId: 'gwas_track',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 250 },
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
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2:191,790,000-192,120,000',
      tracks: [
        {
          trackId: 'sle_gwas_ld',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 200 },
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
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
      // tight round ring nudged down so it isn't clipped at the top edge into an
      // oval (reviewer: make the Tools ring more square/round)
      { type: 'circle', anchor: { text: 'Tools' }, radius: 24, dy: 8 },
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
    // slightly shorter crop for both frames (reviewer)
    crop: { x: 0, y: 0, width: 900, height: 460 },
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add' },
          { type: 'waitForText', text: 'Dotplot view' },
          { type: 'delay', ms: 500 },
        ],
        // box the Add menu button as well as the Dotplot view item (reviewer)
        annotations: [
          { type: 'box', anchor: { text: 'Add' } },
          { type: 'box', anchor: { text: 'Dotplot view' } },
        ],
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

  // Whole-gene overview: coverage histogram, strand-colored splice arcs, and the
  // spliced read pileup over ACTB — the anchor figure for "what RNA-seq looks
  // like". minSashimiScore 3 drops the low-support aligner-noise arcs (see
  // compact_stacked below for the rationale).
  {
    mode: 'url',
    name: 'rnaseq/basic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,567,000-5,570,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            coverageHeight: 120,
            height: 460,
            maxHeight: 2000,
            minSashimiScore: 3,
          },
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 700,
  },

  // Zoomed to 1 kb so reads resolve individually. Default feature height (not
  // compact) keeps each read and its teal per-read splice connector distinct.
  {
    mode: 'url',
    name: 'rnaseq/reads_zoomed',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,568,000-5,569,000',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            coverageHeight: 100,
            height: 460,
            maxHeight: 2000,
            minSashimiScore: 3,
          },
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 700,
  },

  // Tighter window on a few spliced reads: the grey exon-aligned ends joined by a
  // thin teal line across the skipped intron, the per-read connector the "Looking
  // at a specific read" section describes.
  {
    mode: 'url',
    name: 'rnaseq/single_read',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,568,200-5,569,200',
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'Pairend_StrandSpecific_51mer_Human_hg19',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            coverageHeight: 100,
            height: 460,
            maxHeight: 2000,
            minSashimiScore: 3,
          },
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    viewportHeight: 700,
  },

  // Compact read drawing mode: featureHeight 3 / spacing 0 packs the full ACTB
  // read stack into view, with maxHeight raised so the whole pileup renders
  // instead of clipping at "Max layout height reached" — that full, dense stack
  // (deep = highly expressed) is the point compact mode makes, and what the
  // reviewer found unclear at the default maxHeight.
  {
    mode: 'url',
    name: 'rnaseq/compact_stacked',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,500-5,570,500',
      // offset labels so they overlay the tracks (reviewer)
      trackLabels: 'offset',
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,566,000-5,571,000',
      // offset labels so they overlay the tracks (reviewer)
      trackLabels: 'offset',
      tracks: [
        'ncbi_gff_hg19',
        {
          trackId: 'hg_isoforms.fasta_bam',
          // taller SNPCoverage band (reviewer): coverageHeight is the
          // LinearAlignmentsDisplay coverage-track height (default 45).
          // super-compact featureHeight=1 (reviewer) so every isoform read
          // stacks in view instead of hitting "Max layout height reached".
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            coverageHeight: 120,
            height: 620,
            featureHeight: 1,
            featureSpacing: 0,
          },
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 15000,
    // tall enough for the 620px compact pileup + the coverage band + chrome
    viewportHeight: 900,
  },

  // ────────────────────────────────────────────────────────────────────────
  // Phased trio analysis tutorial screenshots
  // ────────────────────────────────────────────────────────────────────────

  // Initial VCF load with default (LinearVariantDisplay) display.
  {
    mode: 'url',
    name: 'trio-basic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1,000,000-1,001,000',
      tracks: ['HG02024_VN049_KHVTrio.chr1.vcf'],
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
    url: lgvSession(DEMO_CONFIG, {
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
    url: lgvSession(DEMO_CONFIG, {
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
    url: lgvSession(DEMO_CONFIG, {
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
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // hap-ibd haplotype blocks painted with LinearMultiRowFeatureDisplay: a row
  // per parental haplotype (father copy 1/2, mother copy 1/2). The child's
  // inherited chromosome is tiled across the paired rows, so each crossover is
  // the crisp boundary where the painted block steps between the two rows.
  {
    mode: 'url',
    name: 'trio-hapibd-painting',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:1-248,956,422',
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.hapibd',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            height: 120,
          },
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // The hap-ibd painting stacked above the same trio VCF in the phased
  // multi-sample variant display, zoomed to a single ~400 kb window around one
  // genotype-corroborated crossover so the painting block-step is crisp and the
  // genotype columns below resolve into individual variants. We feature two real
  // crossovers — one paternal, one maternal — verified against the raw genotype
  // transmission (most painting boundaries are hap-ibd smoothing artifacts that
  // the genotypes don't actually switch across; these two do).
  //
  // Paternal crossover at chr1:29,697,418 — the child's paternal chromosome
  // steps from Father hap2 (light blue) to Father hap1 (dark blue); the mother's
  // row is solid red across the window (no maternal event here). Compare child
  // HG02024 HP0 against father HG02026's two rows.
  //
  // Maternal crossover at chr1:55,753,613 — the child's maternal chromosome
  // steps from Mother hap2 (pink) to Mother hap1 (red). Of every maternal hap-ibd
  // boundary on chr1 this is the only one the raw genotypes actually corroborate:
  // left of it the child's maternally-transmitted allele tracks mom copy 2 at
  // ~95% of mom-heterozygous sites and right of it mom copy 1 at ~98%, a sharp
  // switch in the direction the painting block steps. The other maternal
  // boundaries are hap-ibd smoothing artifacts the genotypes contradict (the
  // child stays on one copy straight across them), so this stays the featured
  // maternal example. Compare child HG02024 HP1 against mother HG02025's two rows.
  //
  // Both crossovers sit at the horizontal center of their 400 kb window
  // (crossover x ≈ 750 CSS px). The multi-sample VCF rows are relabeled via the
  // display `layout` (trioVcfLayout — a friendly `label` per haplotype row,
  // leaving the stable `name`/`sampleName` identity intact) so the sidebar reads
  // Child/Mother/Father hapN, matching the hap-ibd painting's own row names.
  //
  // The callouts make the crossover concrete by colour-coding the two segments
  // with a translucent frame each (maternal greens/oranges, paternal
  // yellows/purples). Left of the breakpoint the child's inherited haplotype
  // matches one parental copy: the left-colour frame wraps both that parental
  // row's left half and the matching left half of the child row. Right of the
  // breakpoint it matches the other parental copy, wrapped in the right-colour
  // frame. The child row therefore carries the two tinted blocks abutting exactly
  // at the crossover, each colour linking the child segment to the specific
  // parental haplotype it was copied from.
  ...(
    [
      {
        name: 'trio-crossover-paternal',
        loc: 'chr1:29,497,418-29,897,418',
        // only paint the father's two haplotypes (reviewer): the mother's rows
        // are solid across this window and just add noise. With the painting
        // filtered to the Father pair they sit at painting rows 0-1.
        paintingFilter: ['Father hap1', 'Father hap2'],
        // Child hap1 (paternal) matches Father hap2 left, Father hap1 right
        annotations: crossoverHighlights({
          child: 'Child hap1',
          leftSource: 'Father hap2',
          rightSource: 'Father hap1',
          palette: TRIO_PATERNAL_COLORS,
          paintingTopRow: 0,
          leftText:
            'Left of the crossover, Child hap1 matches Father hap2 (light blue)',
          rightText: 'Right of it, Child hap1 matches Father hap1 (dark blue)',
        }),
      },
      {
        name: 'trio-crossover-maternal',
        loc: 'chr1:55,553,613-55,953,613',
        // only paint the mother's two haplotypes (reviewer); filtered to the
        // Mother pair they sit at painting rows 0-1.
        paintingFilter: ['Mother hap1', 'Mother hap2'],
        // Child hap2 (maternal) matches Mother hap2 left, Mother hap1 right
        annotations: crossoverHighlights({
          child: 'Child hap2',
          leftSource: 'Mother hap2',
          rightSource: 'Mother hap1',
          palette: TRIO_MATERNAL_COLORS,
          paintingTopRow: 0,
          leftText:
            'Left of the crossover, Child hap2 matches Mother hap2 (pink)',
          rightText: 'Right of it, Child hap2 matches Mother hap1 (red)',
        }),
      },
    ] satisfies {
      name: string
      loc: string
      paintingFilter: string[]
      annotations: Annotation[]
    }[]
  ).map(({ name, loc, paintingFilter, annotations }) => ({
    mode: 'url' as const,
    name,
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc,
      tracks: [
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.hapibd',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            rowHeightOverride: 32,
            // show only this parent's haplotype rows (reviewer)
            subtreeFilter: paintingFilter,
          },
        },
        {
          trackId: 'HG02024_VN049_KHVTrio.chr1.vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            renderingMode: 'phased',
            height: TRIO_VCF_DISPLAY_H,
            // relabel sidebar rows Child/Mother/Father hapN (keeps the
            // canonical HG020xx HPn identity in `name`/`sampleName`)
            layout: trioVcfLayout,
          },
        },
      ],
    }),
    annotations,
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 28000,
  })),

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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [
        { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // shorter browser (reviewer); the details panel scrolls so this only trims
    // empty space below the ringed hyperlink
    viewportHeight: 680,
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
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [
        { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
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
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:38,543,322-41,918,323',
      tracks: ['ncbi_gff_hg19'],
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
    viewportHeight: 380,
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
    // annotations removed (reviewer): just the import form with the URL pasted
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
    // shorter browser (reviewer): the palette + track selector fit comfortably
    viewportHeight: 520,
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
    // shorter browser (reviewer): the palette + track selector fit comfortably
    viewportHeight: 520,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Connected genome + protein demo (TP53 / UniProt P04637). A single ProteinView
  // spec entry creates and connects its own LinearGenomeView via the plugin's
  // `connectedView` launch param, so the genome (NCBI RefSeq + ClinVar) and the
  // AlphaFold structure load linked. This uses the short-form declarative launch:
  // from just `uniprotId` + `transcriptId` the plugin derives the AlphaFold
  // structure URL, resolves the transcript feature from the hg38-ncbiRefSeq track
  // at `loc`, and translates its CDS to the protein sequence it aligns to the
  // structure. Loads protein3d pinned to a published jsDelivr version
  // (PROTEIN3D_CONFIG) against the local build, whose session has the
  // setPendingMove split API the side-by-side launch needs.
  {
    mode: 'url',
    name: 'protein/connected',
    url: `?config=${PROTEIN3D_CONFIG}&session=${encodeURIComponent(
      `spec-${JSON.stringify({
        views: [
          {
            type: 'ProteinView',
            uniprotId: 'P04637',
            transcriptId: 'NM_000546.6',
            height: 540,
            // place the protein view to the right of its connected genome view
            // (left genome | right protein) via the workspaces split layout
            sideBySide: true,
            // keep the connected genome at the gene-wide view when a domain is
            // clicked so the domain shows as a highlighted sub-region
            zoomToBaseLevel: false,
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
    // paint beat at deviceScaleFactor 2, which can lag the model state a frame.
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // the molstar 3D structure canvas only rasterizes cleanly (cartoon detail +
    // the magenta motif selection highlight) under headless Firefox; headless
    // Chrome's swiftshader renders it as a featureless blob, which is needed on mac only
    // firefox: true,

    // Click the TP53 nuclear export signal (UniProt "Motif" 339-350) on the
    // protein feature track to drive the genome↔structure cross-highlight: the
    // motif residues select in the 3D structure (molstar) and a highlight band
    // is drawn over the connected LGV (NCBI RefSeq + ClinVar) at the mapped
    // genome region. The Motif track is used here rather than the Region track:
    // Region features (e.g. the 325-356 tetramerization region used previously)
    // are long and overlap each other, whereas the five UniProt motifs are
    // short and non-overlapping, so the clicked feature and its highlight read
    // cleanly. Feature bars expose data-testid (protein3d ≥ v0.4.14), but
    // "Motif" is shared by all five motifs, so data-feature-start disambiguates
    // this one (12 residues, well within the alignment track's 649px
    // horizontally-scrollable viewport). `scroll` centers the target in its
    // scrollable ancestor before the click, since the motif starts past residue
    // ~115, off the default-scrolled viewport.
    actions: [
      {
        type: 'waitForSelector',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      {
        type: 'scroll',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      { type: 'delay', ms: 6000 },
    ],
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
    url: lgvSession(DEMO_CONFIG, {
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
          // "Cluster rows by score..." now lives under a "Clustering" submenu
          { type: 'waitForText', text: 'Clustering' },
          { type: 'hover', text: 'Clustering' },
          { type: 'waitForText', text: 'Cluster rows by score...' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Cluster rows by score...' },
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
    url: lgvSession(VOLVOX, {
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
  {
    // The UCSC ce11 26-way multiz alignment (real cross-species nematode data):
    // the coverage band on top, then one row per aligned species (guide tree on
    // the left from the track's .nh), zoomed in enough to read bases — each
    // colored where a species differs from the reference. Remote 26-way data is
    // slow to fetch + render, so the settle is long.
    mode: 'url',
    name: 'maf_track',
    url: lgvSession(CE_MAF, {
      // zoomed out further (reviewer): wider window so the per-species
      // mismatch columns read as a conservation pattern, not just a handful
      // of bases
      assembly: 'ce11',
      loc: 'chrI:3,000,648-3,001,368',
      tracks: [
        {
          trackId: 'ce11.26way',
          // fit-to-display-height is the default; rows fill heightOverride
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 360,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 640,
    settleMs: 18000,
    hideTooltip: true,
    // park the cursor in the nav bar so no coverage-band hover tooltip lingers
    // over the capture
    actions: [
      { type: 'hover', from: { x: 250, y: 100 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // The conservation (percent identity) band on the real 26-way alignment:
    // toggle it on via the track menu (top frame) and the per-base
    // identity-to-reference profile appears above the rows (bottom frame).
    // Zoomed out across several kb so the sliding-window profile — conserved
    // (coding) vs divergent regions — is the readable signal, not the bases.
    mode: 'url',
    name: 'maf_conservation',
    url: lgvSession(CE_MAF, {
      assembly: 'ce11',
      loc: 'chrI:2,998,500-3,001,800',
      tracks: [
        {
          trackId: 'ce11.26way',
          // fit-to-display-height; rows shrink to make room when the
          // conservation band is toggled on below
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 320,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 560,
    settleMs: 10000,
    hideTooltip: true,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Show...', 'Show conservation (% identity)']),
        ],
        annotations: cascadeBoxes([
          'Show...',
          'Show conservation (% identity)',
        ]),
      },
      {
        actions: [
          { type: 'click', text: 'Show conservation (% identity)' },
          // wait for the menu to close — keyed on a menu-only label, since the
          // conservation band now carries an on-canvas "Conservation" title that
          // would otherwise keep that text visible forever
          { type: 'waitForText', text: 'Show...', hidden: true },
          { type: 'hover', from: { x: 250, y: 100 } },
          { type: 'delay', ms: 2500 },
        ],
      },
    ],
  },
  {
    // Codon-view hover tooltip: in the per-species codon translation, hovering a
    // codon cell reads out the species codon + amino acid alongside the reference
    // codon + amino acid and the syn/nonsyn classification, so a specific change
    // is identifiable rather than inferred from the cell color.
    mode: 'url',
    name: 'maf_codon_tooltip',
    url: lgvSession(CE_MAF_FRAMES, {
      assembly: 'ce11',
      loc: 'chrI:2,999,200-2,999,370',
      tracks: [
        {
          trackId: 'ce11.26way',
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 470,
            showTranslation: true,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 600,
    settleMs: 12000,
    actions: [
      { type: 'hover', from: { x: 500, y: 300 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // Color-by-source-chromosome SV mode on the 26-way alignment: each species'
    // alignment blocks are filled by a stable color of their source chromosome
    // (MCGV "color by chromosome"), so a row drawing from more than one source
    // chromosome changes color — a translocation/rearrangement flag with no
    // extra fetch. A compact legend (top-right) maps each visible source
    // chromosome to its color.
    mode: 'url',
    name: 'maf_color_by_chromosome',
    url: lgvSession(CE_MAF_FRAMES, {
      assembly: 'ce11',
      loc: 'chrI:2,995,000-3,003,000',
      tracks: [
        {
          trackId: 'ce11.26way',
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 400,
            colorByChromosome: true,
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 560,
    settleMs: 12000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 250, y: 100 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // Inversion (strand-flip) indicator. Filtered to a few species (incl. bruMal2,
    // which has a genuine intra-scaffold inversion here) at a tall row height so
    // the flip reads clearly: bruMal2's left block aligns on the opposite strand
    // from the rest of its scaffold and is hatched + outlined, while its other
    // blocks (the scaffold's consensus orientation) are left plain. CDS frames
    // are off (the default) so the only overlay is the inversion cue.
    mode: 'url',
    name: 'maf_inversions',
    url: lgvSession(CE_MAF_FRAMES, {
      assembly: 'ce11',
      loc: 'chrI:3,000,300-3,002,800',
      tracks: [
        {
          trackId: 'ce11.26way',
          // fit-to-display-height: the 5 filtered rows fill the track tall
          // enough for the strand-flip hatch to read clearly
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 200,
            showInversions: true,
            subtreeFilter: ['ce11', 'caeRem4', 'cb4', 'bruMal2', 'triSpi1'],
          },
        },
      ],
    }),
    readyText: 'chrI',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 460,
    settleMs: 12000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 250, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  {
    // Dense comparative view: the UCSC hg38 470-way multiz (mammals + more), all
    // ~470 species at once over the GAPDH gene with the per-row identity heatmap
    // pinned on (red = divergent, blue = conserved). The coding exons light up as
    // conserved blue bands across the whole phylogeny while the introns stay red
    // — genome-scale conservation read at a glance. Remote UCSC data, generous
    // timeout.
    mode: 'url',
    name: 'maf_470way',
    url: lgvSession(HG38_470WAY, {
      assembly: 'hg38',
      loc: '12:6,534,400-6,538,500',
      tracks: [
        {
          trackId: 'hg38.multiz470way',
          // fit-to-display-height: the `height` config slot pins the whole
          // display to 600px while rowHeight stays at its default 0 (fit mode),
          // so all ~470 rows squeeze into 600px at ~1px each. Rows go sub-pixel
          // but the conserved/divergent banding still reads as a texture, and
          // the whole phylogeny is visible at once instead of scrolling off.
          // The top-right legend names the red/blue ramp.
          displaySnapshot: {
            type: 'LinearMafDisplay',
            height: 600,
            rowIdentityMode: 'heatmap',
            rowIdentityAutoZoom: false,
          },
        },
      ],
    }),
    readyText: '6,53',
    readyTimeout: 120000,
    viewportWidth: 1100,
    // tall enough that the whole 600px fit-to-height display + the view header
    // sit inside the frame with no scroll-off
    viewportHeight: 800,
    // all ~470 species over remote UCSC data — long settle so the heatmap is
    // fully painted and the loading indicator has cleared before capture
    settleMs: 35000,
    hideTooltip: true,
    actions: [{ type: 'delay', ms: 2000 }],
  },
  {
    // The hg38 470-way narrowed to a representative ~30 mammals (subtreeFilter,
    // HG38_470WAY_30) in codon view over a conserved GAPDH exon: each species'
    // coding sequence is translated in the human reading frame, so conserved
    // residues line up and the few amino-acid changes in the more distant
    // species stand out. With the tree-pruning fix the guide tree on the left is
    // the pruned ~30-leaf dendrogram (not the full 470-species tree). Chromosome-
    // level human reference reads far cleaner than a fragmented scaffold MAF.
    //
    // The conservation band on top is in codon mode (`conservationMode: 'codon'`):
    // each bar is the fraction of species whose *amino acid* matches the human
    // reference, so synonymous (silent) 3rd-position changes read as conserved and
    // the profile tracks protein-level constraint rather than nucleotide drift —
    // exactly the metric a coding alignment calls for.
    mode: 'url',
    name: 'maf_470way_codon',
    url: lgvSession(HG38_470WAY, {
      assembly: 'hg38',
      // window trimmed to sit fully inside one GAPDH coding exon (reviewer): the
      // original ran a few bp past the exon 3' end, so the species that have no
      // aligned block there drew empty "bridge" e-lines on the right that read as
      // artifacts. The codon view is now gap-free across the window: reviewers
      // earlier saw blank columns spanning every row (reference included) where a
      // reference codon's three bases straddle a MAF alignment-block boundary —
      // those codons were dropped (computeVisibleCodons required all three in one
      // block) while the block-agnostic per-base coverage stayed continuous.
      // computeVisibleCodons/computeCodonConservation now stitch a codon across
      // blocks (locateCodon resolves each base to whichever block holds it), so
      // the codon layer lines up with the coverage band above it.
      loc: '12:6,536,485-6,536,590',
      tracks: [
        {
          trackId: 'hg38.multiz470way',
          // fit-to-display-height: the ~30 filtered rows fill the track tall
          // enough to read the per-codon amino acids
          displaySnapshot: {
            type: 'LinearMafDisplay',
            heightOverride: 560,
            showTranslation: true,
            showConservation: true,
            conservationMode: 'codon',
            subtreeFilter: HG38_470WAY_30,
          },
        },
      ],
    }),
    readyText: '6,536,5',
    readyTimeout: 120000,
    viewportWidth: 1000,
    // tall enough to show all ~30 fitted rows + the pruned guide tree
    viewportHeight: 820,
    settleMs: 18000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 250, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
  // ────────────────────────────────────────────────────────────────────────
  // Admin-mode screenshots (quickstart_adminserver.md). Admin mode is enabled
  // purely by the &adminKey= URL param (adminMode = !!adminKey, client-side), so
  // these reproduce the admin-server's UI without a running admin-server backend
  // — the dialogs render the same; only persisting writes needs the real server.
  // ────────────────────────────────────────────────────────────────────────

  // Empty assembly manager: a fresh install (empty.json has no assemblies) in
  // admin mode, Tools -> Assembly manager opened to its empty table. sessionSpec
  // gives a static sessionName so the title bar carries no live timestamp.
  {
    mode: 'url',
    name: 'assembly_manager',
    url: `${sessionSpec('test_data/empty.json', {
      views: [{ type: 'LinearGenomeView' }],
    })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 540,
    settleMs: 2000,
    hideTooltip: true,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Assembly manager with one assembly present: a config carrying only hg38 in
  // admin mode, so the manager table lists the hg38 row (the state after adding
  // an assembly in the tutorial).
  {
    mode: 'url',
    name: 'hg38_assembly_table',
    url: `${sessionSpec('test_data/hg38_only.json', {
      views: [{ type: 'LinearGenomeView' }],
    })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 540,
    settleMs: 2000,
    hideTooltip: true,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Set-default-session dialog: admin mode, Admin -> Set default session. The
  // dialog is a simple confirm ("Set current session as default" / "Clear
  // default session"); persisting the choice needs the real admin-server.
  // Two-stage figure (reviewer: show what to click to open it): stage 1 rings the
  // "Set default session" item in the open Admin menu (the menu only appears in
  // admin mode); stage 2 is the resulting dialog.
  {
    mode: 'url',
    name: 'default_session_form',
    url: `${sessionSpec('test_data/empty.json', {
      views: [{ type: 'LinearGenomeView' }],
    })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 480,
    settleMs: 2000,
    hideTooltip: true,
    stages: [
      {
        actions: [
          { type: 'click', text: 'Admin' },
          { type: 'waitForText', text: 'Set default session' },
          { type: 'delay', ms: 300 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Set default session' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Set default session' },
          { type: 'waitForText', text: 'Clear default session' },
          { type: 'delay', ms: 500 },
        ],
      },
    ],
  },

  // Fresh-install landing: with no config and the default config.json missing,
  // jbrowse-web shows the "It worked! JBrowse 2 is installed" banner plus a list
  // of sample configs — what a user sees right after `jbrowse create` + serve.
  {
    mode: 'url',
    name: 'config_not_found',
    url: '',
    readyText: 'It worked!',
    viewportWidth: 1200,
    viewportHeight: 720,
    settleMs: 1500,
  },

  // The embed tutorial's hero figure: the *embedded*
  // `@jbrowse/react-linear-genome-view2` component (not the jbrowse-web app),
  // captured from its prebuilt UMD bundle via the script-tag setup the tutorial
  // documents. `viewState` mirrors the hg38 config in
  // docs/tutorials/embed_linear_genome_view.md verbatim (gene / repeat /
  // alignment / variant / conservation tracks at the MYD88 locus). Remote hg38
  // data (jbrowse.org + UCSC phyloP) — long ready timeout + settle, and a
  // relaxed diff gate since remote-timing jitter is irreducible.
  {
    mode: 'embedded',
    name: 'embed_linear_genome_view/final',
    viewState: {
      assembly: {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'GRCh38-ReferenceSequenceTrack',
          adapter: {
            type: 'BgzipFastaAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'RefNameAliasAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
          },
        },
        cytobands: {
          adapter: {
            type: 'CytobandAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/cytoBand.txt',
          },
        },
      },
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'ncbi_genes',
          name: 'NCBI RefSeq Genes',
          assemblyNames: ['hg38'],
          category: ['Genes'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
          },
        },
        {
          type: 'FeatureTrack',
          trackId: 'repeats_hg38',
          name: 'Repeats',
          assemblyNames: ['hg38'],
          category: ['Annotation'],
          adapter: {
            type: 'BigBedAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/repeats.bb',
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'NA12878_exome',
          name: 'NA12878 Exome',
          assemblyNames: ['hg38'],
          category: ['1000 Genomes', 'Alignments'],
          adapter: {
            type: 'CramAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
          },
        },
        {
          type: 'VariantTrack',
          trackId: '1000g_vcf',
          name: '1000 Genomes Variant Calls',
          assemblyNames: ['hg38'],
          category: ['1000 Genomes', 'Variants'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'phyloP100way',
          name: 'hg38.100way.phyloP100way',
          category: ['Conservation'],
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BigWigAdapter',
            uri: 'https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
          },
        },
      ],
      defaultSession: {
        name: 'My session',
        margin: 0,
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: '10:29,838,565..29,838,850',
            tracks: [
              'GRCh38-ReferenceSequenceTrack',
              'ncbi_genes',
              'NA12878_exome',
              'phyloP100way',
              '1000g_vcf',
            ],
          },
        },
      },
    },
    readyText: 'NCBI RefSeq Genes',
    readyTimeout: 90000,
    settleMs: 15000,
    viewportWidth: 1200,
    viewportHeight: 1000,
    diffThreshold: 0.02,
  },

  // products/jbrowse-img/README.md example images, rendered by the jb2export
  // CLI (see CliSpec above). Ported 1:1 from the old
  // render-comparative-examples.sh so the args stay in sync with the README's
  // own copy-pastable commands.
  ...jbrowseImgSpecs,
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

// Every figure produced by a spec, whether or not it has a public live URL.
// audit-figures uses this to classify a figure as autogenerated — an embedded
// or localhost-build capture is still autogenerated even though it has no
// interactive jbrowse.org link.
export const screenshotSpecNames = new Set(specs.map(spec => spec.name))

// Split a `--filter a,b,c` value into trimmed, non-empty tokens. Shared by the
// generate and review scripts so `--filter`/`--exact` mean the same thing in
// both.
export function parseFilterTokens(filter: string | undefined) {
  return filter
    ? filter
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : []
}

// True when `name` matches any filter token (exact name or substring). An empty
// token list matches everything, so an absent --filter selects all specs.
export function matchesFilterTokens(
  name: string,
  tokens: string[],
  exact: boolean,
) {
  return (
    tokens.length === 0 ||
    tokens.some(t => (exact ? name === t : name.includes(t)))
  )
}
