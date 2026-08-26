// What every spec module shares: session-URL builders, the action/callout
// idioms, and the few configs and session tracks that genuinely appear in more
// than one module's figures.
//
// NOTHING WITH ONE CONSUMER BELONGS HERE, and the reason is not tidiness. This
// file is a `website/scripts/screenshot-` prefix, so it matches
// GLOBAL_TRIGGERS in screenshot-impact.ts and a one-line edit to anything in it
// answers `--affected` with "all 355". A dataset constant used by one
// specs/*.ts, kept in that file, narrows to that file's specs instead. It had
// grown to 1680 lines that way — the jb2export spec list, the trio callout
// vocabulary, and eight datasets' track definitions, each read by exactly one
// module.
//
// So the test for a new export is whether a SECOND spec module needs it. If not,
// it goes next to the specs that use it; if a second one turns up later, it
// moves here then.
import { displaySettled, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { Annotation, ScreenshotAction } from './screenshot-spec-types.ts'

export const VOLVOX = 'test_data/volvox/config.json'
// HG002 ultralong ONT BAM (the same file the DEMO_CONFIG hg002_nanopore track
// points at). Used to build the two HP-grouped session subtracks the smalldel
// group-by figure renders.
//
// A rehosted slice of GIAB's HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam, not
// the NCBI original: ftp-trace throttles concurrent range requests and answered
// one with a 503 mid-run, which fails a capture on infrastructure rather than on
// anything the figure is about. The slice carries the three hs37d5 windows every
// HG002 figure uses (1:55.69-55.72Mb, 1:62.99-63.02Mb, 1:161.155-161.2Mb), so a
// spec that pans outside them sees no reads.
export const HG002_NANOPORE_BAM =
  'https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam'
const HG002_NANOPORE_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG002_NANOPORE_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${HG002_NANOPORE_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
// The HP-grouped HG002 ONT session track shared by the haplotype / groupby /
// smalldel figures (session tracks don't inherit the config, so it carries its
// own adapter). Referenced as a const so all three encode byte-identically.
export const HG002_NANOPORE_HP_TRACK = {
  type: 'AlignmentsTrack',
  trackId: 'hg002_nanopore_hp',
  name: 'HG002 ONT',
  assemblyNames: ['hg19'],
  adapter: HG002_NANOPORE_ADAPTER,
}
// HG00151 Oxford Nanopore reads from the 1000 Genomes ONT Sequencing Consortium
// (s3://1000g-ont), minimap2-aligned to hg38. Deliberately the MINIMAP2_ALIGNED_BAMS
// file, NOT the NAPU/PMDV_FINAL.haplotagged.bam — the DeepVariant-haplotagged
// output drops the supplementary (SA-tag) split alignments, so an inversion's
// split reads vanish from it; the minimap2 alignment is the one the consortium's
// SV callers used and where the fwd/rev split at the breakpoint is visible.
// Paired with HG00151's Illumina high-coverage CRAM (HG00151.final, in the KG
// config) for the same-sample short-vs-long inversion figure.
// Sliced to chr1:197,780,000-197,796,000 and re-hosted, the same treatment (and
// for the same two reasons) as specs/features.ts's PTEN_RNASEQ_BAM: the whole-genome file
// lives on a bucket we do not run, and range-querying it is what a CI figure
// sweep would depend on. 4 MB, and the slice keeps what the figures read — all
// 87 SA-tag split alignments across the inversion, and the MM/ML calls.
export const HG00151_ONT_1000G_BAM =
  'https://jbrowse.org/demos/ont/HG00151-ONT-hg38.chr1_inversion.bam'
export const HG00151_ONT_1000G_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG00151_ONT_1000G_BAM, locationType: 'UriLocation' },
  index: {
    location: {
      uri: `${HG00151_ONT_1000G_BAM}.bai`,
      locationType: 'UriLocation',
    },
    indexType: 'BAI',
  },
}
// hg38 vs T2T-CHM13 (hs1) from the hosted UCSC hg38->hs1 liftOver PIF, plus
// NCBI RefSeq genes on both. Backs the TNNT3 figure that reproduces the
// genomes.jbrowse.org/demos/ session.
export const HG38_HS1_CONFIG = 'test_data/hg38_hs1_synteny/config.json'

// genomes.jbrowse.org's own hg38 config: the UCSC hub build, which already
// carries every `hg38_to_<db>_liftOver` SyntenyTrack plus the RefSeq gene
// tracks. The genomes_synteny tutorial figures load *this* file (against the
// local build) rather than a repo test_data config, so the click-path they
// document is the one a reader gets on the real site. It declares only hg38,
// but it also loads the Hubs plugin, whose Core-handleUnrecognizedAssembly
// handler pulls in hs1 the moment the hg38->hs1 liftOver track references it —
// which is why no sessionAssembly is needed to make the launch item appear.
export const UCSC_HG38_CONFIG = encodeURIComponent(
  'https://jbrowse.org/ucsc/hg38/config.json',
)
export const DEMO_CONFIG = 'test_data/config_demo.json'
// Load the remote demo configs against the *local* build (a bare ?config= url
// that the generator prefixes with localhost), so unreleased display settings
// like the LinearSyntenyView drawCurves view property render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns the
// bare url into a jbrowse.org/code/jb2/latest link for the docs reader links.
const CGIAB_BASE = `?config=${encodeURIComponent('https://jbrowse.org/demos/cgiab/config.json')}`
const HPYLORI_BASE = `?config=${encodeURIComponent('https://jbrowse.org/demos/hpylori/config.json')}`

// UCSC RepeatMasker for hg38 (jb2hubs golden-path build) as a session track: a
// BedTabix whose `#`-header exposes a `repClass` column (SINE/LINE/LTR/DNA/
// Simple_repeat/Low_complexity/…). The repo's one feature track with real
// categorical variety, so it backs both the color-by-category recipe and the
// multi-row figures, where `repClass` is what a row is split on.
export const HG38_RMSK_TRACK = {
  type: 'FeatureTrack',
  trackId: 'rmsk_hg38_ucsc',
  name: 'RepeatMasker',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    bedGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/rmsk.bed.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'CSI',
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/rmsk.bed.gz.csi',
        locationType: 'UriLocation',
      },
    },
  },
}

// GENCODE v48 promoter windows (UCSC hub build, jbrowse.org/ucsc/hg38) as a
// session track, for figures that want promoter context without the full
// ENCODE cCRE/chromatin-state tracks.
export const HG38_GENCODE_PROMOTER_TRACK = {
  type: 'FeatureTrack',
  trackId: 'gencode_promoter_hg38_ucsc',
  name: 'GENCODE v48 promoter windows (UCSC)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/gencode.v48.promoter_windows.sorted.gff3.gz',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/gencode.v48.promoter_windows.sorted.gff3.gz.csi',
        locationType: 'UriLocation',
      },
      indexType: 'CSI',
    },
  },
}

// Wait for ONE display to be finished, by the testid it passes to DisplayChrome
// (`pileup-display`, `variant-matrix-display`, ...).
//
// MOST SPECS DO NOT NEED THIS. `settlePass` already runs `waitForDisplayPhases`
// then `waitForDisplaysDone` on every capture, so a bare
// `displayPainted(testid)` — the form nearly every spec here uses — is normally
// enough, and generate-screenshots.ts says so at `settlePass`.
//
// Reach for this only where the display's FETCH MAY START LATE. The global gate
// is "no element is at data-display-phase=loading", which is trivially true in
// the window before a display has entered `loading` at all — so a big remote
// track (HPRC release 2's 2.3 GB wave VCF is the worked example, and
// specs/graph-hprc.ts's hprc_graph_vs_callset is where it is read that way) can sail
// through it and be captured empty. Waiting on `data-display-phase=ready` on
// the display itself closes that window: the phase covers the whole fetch,
// where `data-display-drawn` is first paint, which an empty canvas reaches on
// its own.
//
// This used to accept two arrangements, because the two attributes were not
// always on the same element: alignments derived its chrome testid from
// `displayId` and hand-wrote `pileup-display-done` on an inner div, so there
// they had to be related with `:has()`. Each form matched nothing in the other's
// case, and the symptom was a capture that timed out rather than an error at
// authoring time. Every display now emits both from its one chrome element, so
// the plain conjunction is the whole selector — which is `displaySettled`, and
// this is the alias the specs read by.
export const displayReady = displaySettled

// Deliberately carries NO `renderer=` pin, though the figure corpus needs one.
// These urls have a second consumer: `gen-gallery-links.ts` bakes them into
// `galleryLinks.generated.ts`, which is what a website visitor clicks to open a
// demo. Pinning here reached those links too, so a visitor on a software
// rasterizer would have been forced onto WebGL — the exact machine the ladder in
// `createHal.ts` exists to route away from it. The pin belongs at capture time
// instead: `pinRenderer` in screenshot-ready.ts, applied by both navigation
// paths, plus the embedded harness which sets it through the product's API.
export function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// The overwhelmingly common spec shape: a session with a single
// LinearGenomeView. `view` carries the view-level props (assembly/loc/tracks and
// any extras like colorByCDS/trackLabels); `type: 'LinearGenomeView'` is filled
// in. Encodes identically to the hand-written `sessionSpec(cfg, { views: [{ type:
// 'LinearGenomeView', ...view }] })`, so it never changes a rendered image.
export function lgvSession(
  config: string,
  view: { assembly: string } & Record<string, unknown>,
) {
  return sessionSpec(config, {
    views: [{ type: 'LinearGenomeView', ...view }],
  })
}

// Expand a menu drill-down into wait/hover actions: each non-terminal item is
// hovered to open its submenu; the terminal item is only waited for. The caller
// lists the whole path, so an intermediate level can't be skipped — the failure
// that left `modifications1` waiting on a submenu its parent never opened. Pair
// with `cascadeBoxes` to keep the callout boxes on the same path.
//
// Each level used to end in a fixed `delay` (500ms by default, hand-tuned to
// 300/600/800 at six call sites) because a popper is visible a frame or two
// before popper.js has finished positioning it, so the next hover could land on
// a menu still moving. `waitForText` now returns only once the item's rect has
// held still — the wait watches the thing that has to settle instead of guessing
// how long it takes — so the delay has nothing left to pay for.
export function menuCascade(path: string[]): ScreenshotAction[] {
  return path.flatMap((text, i) => {
    const parent = path[i - 1]
    return [
      ...(parent ? [{ type: 'hover' as const, text: parent }] : []),
      { type: 'waitForText' as const, text },
    ]
  })
}

// Box every item along a menu path — the callout counterpart to `menuCascade`,
// so the highlighted items can't drift from the items actually hovered.
export function cascadeBoxes(path: string[]): Annotation[] {
  return path.map(text => ({ type: 'box' as const, anchor: { text } }))
}

export const trackMenuIcon = (trackId: string): ScreenshotAction => ({
  type: 'click',
  selector: `[data-testid="track_menu_icon"][data-trackid="${trackId}"]`,
})

// Open the alignments "Read height" submenu and leave it open.
// CascadingSubmenu opens on click as well as hover (onClick -> onOpen), and a
// click is deterministic where a hover is timing-sensitive (the pileup keeps
// re-laying-out while reads stream, so the hovered row can move out from under
// the cursor). Target the submenu row by its data-testid prefix.
export const openFeatureHeightSubmenu = (): ScreenshotAction[] => [
  { type: 'waitForText', text: 'Read height' },
  {
    type: 'click',
    selector: '[data-testid^="cascading-submenu-read_height"]',
  },
  { type: 'waitForText', text: 'Super-compact' },
]

// Park the mouse somewhere that cannot react to it, so no overview-ruler
// position readout or feature hover is left hanging in the capture.
//
// The JBrowse wordmark in the app bar, by its own `aria-label`, rather than the
// `{ x: 950, y: 60 }` this idiom used to be written as. That point was described
// in every copy as "the inert app header" and is nothing of the sort: at
// viewportWidth 1000 it lands in the *view's* title bar a few px from the
// minimize button, so it was one toolbar tweak away from parking the cursor on a
// control and one narrower viewport away from parking it on the canvas. The
// wordmark is the only thing up there that is guaranteed inert — it is an svg
// with no handlers — and it moves with the layout instead of having to be
// re-measured when the layout moves.
//
// The swap is inert: of the 16 figures converted, every one whose spec changed
// in no other way came back byte-identical. The six that did move moved on app
// drift accumulated since they were last swept — `alignments_soft_clipped_menu`
// gained a `Launch` item and lost `Set max layout height...`, which is 12%
// of its pixels and nothing to do with where the cursor sits. Those six were
// restored from the store rather than committed, so the sweep can pick the drift
// up on its own with nothing else in the diff.
export const PARK_CURSOR: ScreenshotAction = {
  type: 'hover',
  selector: '[aria-label="JBrowse"]',
}

// Shrink the gene track's isoform notice — the loud "Isoforms trimmed" / "RefSeq
// Select" chip — to the quiet icon that is always in that corner afterwards.
// The chip carries no (×): opening its menu is what marks the notice read, so
// this opens it and closes it again with Escape, which `useTrackControlMenu`
// handles directly (unlike the MUI menu cascade `dismissMenus` backs out of).
// Every step is asserted, because a chip left up moves the corner of every
// later frame.
//
// `geneGlyphNoticeDismissed` is VOLATILE (LinearBasicDisplay/model.ts) — a
// session spec cannot set it, and this is the only way in. `track-control-isoform`
// is the testid both TrackControl implementations put on the control, chip and
// icon alike: the class names are tss-react hashes and MUI strips its own icon
// `data-testid` from production builds, so the built app the generator serves
// offers nothing else to point at but the tooltip prose.
export const readIsoformNotice = (): ScreenshotAction[] => [
  { type: 'click', selector: '[data-testid="track-control-isoform"]' },
  { type: 'waitForText', text: 'Representative transcript' },
  { type: 'press', key: 'Escape' },
  { type: 'waitForText', text: 'Representative transcript', hidden: true },
  { type: 'delay', ms: 300 },
]

// A stage that ends with its submenu open must be fully dismissed before the
// next stage clicks a different track's menu, or the lingering menu's backdrop
// swallows that click and it lands on the wrong track. Escape does NOT close
// these menus (keyboard focus isn't inside the popover), but the invisible modal
// backdrop does on click — two clicks on a neutral spot (the view title bar)
// pop the submenu then the main menu; then wait for the menu text to be gone.
export const dismissMenus = (): ScreenshotAction[] => [
  { type: 'click', from: { x: 550, y: 58 } },
  { type: 'delay', ms: 300 },
  { type: 'click', from: { x: 550, y: 58 } },
  { type: 'waitForText', text: 'Read height', hidden: true },
  { type: 'delay', ms: 300 },
]

// Open the hierarchical track selector and leave it open, by whichever of the
// three routes the figure wants. Eleven specs across three modules took one of
// them, written out identically each time.
//
// `via` is a real choice rather than a default worth hiding, which is why it is
// required:
//
//   'menu'    the view hamburger -> "Open track selector". The route a tutorial
//             walks a reader through, and the only one that shows the item.
//   'button'  the header button by its `title`. For the frames where the view
//             menu must NOT be left standing over the capture, and for a view
//             with no tracks active — the body then renders an "Open track
//             selector" button of its own, so a text click is ambiguous where
//             the title is unique.
//   'text'    the same button by its visible text, for the frames where only
//             one of them is on screen. Shorter, and it fails loudly if a
//             second ever appears rather than picking one.
export const openTrackSelector = (
  via: 'menu' | 'button' | 'text',
): ScreenshotAction[] => [
  ...(via === 'menu'
    ? ([
        { type: 'click', selector: '[data-testid="view_menu_icon"]' },
        { type: 'waitForText', text: 'Open track selector' },
        { type: 'click', text: 'Open track selector' },
      ] as const)
    : via === 'button'
      ? ([
          { type: 'click', selector: 'button[title="Open track selector"]' },
        ] as const)
      : ([{ type: 'click', text: 'Open track selector' }] as const)),
  {
    type: 'waitForSelector',
    selector: '[data-testid="hierarchical_track_selector"]',
  },
]

// Track menu -> Launch -> Reconstruct derivative allele..., waited out to
// the candidate list. Four figures across the cancer_sv and sv pages take this
// route, and sv.ts's own comment used to promise they were "in the same shape
// and wording" — a promise a helper keeps instead.
//
// The wait is the reconstruction itself, which walks every read's SA chain over
// the pileup, so the caller states the timeout its own coverage earns.
export const reconstructDerivativeAllele = (
  timeout: number,
): ScreenshotAction[] => [
  { type: 'click', text: 'Launch' },
  { type: 'click', text: 'Reconstruct derivative allele...' },
  {
    type: 'waitForSelector',
    selector: '[data-testid="derivative-path-candidates"]',
    timeout,
  },
]

// The same route as a callout, for the frames that show the dialog and have to
// say how it was reached. Beside the actions rather than typed out per figure,
// the same way `cascadeBoxes` pairs with `menuCascade`: a reworded menu item is
// then one edit, where four hand-written copies drift one at a time and the
// figure keeps asserting a click path the spec no longer takes.
export const DERIVATIVE_ROUTE_LABEL =
  'Track menu → Launch → Reconstruct derivative allele...'

export function cgiabUrl(session?: object) {
  if (!session) {
    return CGIAB_BASE
  }
  return `${CGIAB_BASE}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

export function hpyloriUrl(session: object) {
  return `${HPYLORI_BASE}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// remote 1000-genomes config loaded against the *local* build (a bare ?config=
// url), so new display settings like readConnections render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns
// this into a jbrowse.org link for readers.
//
// `demos/` rather than the `genomes/GRCh38/1000genomes/` path it sat under
// until 2026-08-23, which is where every other hand-built config we host
// lives. The old url still serves the same file and keeps working.
const KG_CONFIG = 'https://jbrowse.org/demos/1000g/config.json'

export function kgUrl(session: object) {
  return `?config=${encodeURIComponent(KG_CONFIG)}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}
