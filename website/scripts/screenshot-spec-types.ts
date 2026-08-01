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
  // override the default 30s wait for this action's target (FIND_TIMEOUT), for
  // waits and for the click/hover/type/scroll target lookup alike.
  // Use for actions gated on real heavy compute (e.g. RPC
  // clustering over thousands of samples) that can legitimately run long,
  // especially on a slower CI runner.
  timeout?: number
  // for 'type': text to type into the focused/selected input
  value?: string
  // for 'type': triple-click the field to select existing content first
  clear?: boolean
  // for 'drag': start/end points in viewport CSS px (used for rubberband drags).
  // 'click'/'rightclick'/'hover' also accept `from` alone, to act on a bare
  // viewport coordinate (canvas-drawn features have no DOM node to target).
  //
  // 'scroll' takes neither: it centers the target (selector/text) in its nearest
  // horizontally-scrollable ancestor — e.g. a wide feature bar in a horizontally
  // scrollable alignment track that's otherwise off the right edge.
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  // for 'click'/'rightclick'/'hover': resolve the point to act on from the live
  // model instead of writing it down. Only the `graphNode` kind is supported —
  // the case `from` existed for (a canvas with no element per feature) where the
  // app can still say where the feature was drawn. Takes precedence over `from`.
  anchor?: AnnotationAnchor
}

// What an annotation attaches itself to, resolved at capture time so the
// callout tracks the real thing instead of a hand-measured pixel. Three kinds,
// in decreasing order of preference:
//
// - `track` + `locus`: MODEL anchoring. Reads the live LGV model
//   (`window.JBrowseSession`) for the track's rendering container and the
//   locus's pixel position, so a callout lands on a genomic coordinate. Nothing
//   to re-measure when a track height, viewport width, or zoom changes. Use
//   this for anything pointing at data.
// - `graphNode`: MODEL anchoring for a GraphGenomeView. A graph is one canvas
//   with no element per node, so a callout at a node used to be a raw viewport
//   coordinate that only held while the layout was deterministic — changing
//   `layoutMode` silently moved every one of them. This reads the view's own
//   `nodePositions` through its `scale`/`translateX`/`translateY`, so a node is
//   named by its GFA segment id and the layout can change underneath it.
// - `selector`: the first matching element.
// - `text`: the smallest-area element whose visible text matches — for menu
//   items and buttons with no testid. Scans the whole document, so prefer
//   `selector` where one exists.
export interface AnnotationAnchor {
  selector?: string
  text?: string
  // GFA segment id in the `view`-th view, which must be a GraphGenomeView. The
  // resolved rect is the node's drawn polyline bounds in viewport px.
  graphNode?: string
  // which view to resolve against: an index into `session.views` (default 0).
  // An array descends through nested `.views` — `[0, 1]` is the second LGV of a
  // comparative/breakpoint-split view.
  view?: number | number[]
  // config `trackId` of the track supplying the y band and the x origin. Its
  // rendering container is the same element the blocks draw into, so a locus
  // resolved against it lands exactly where the feature is painted. On its own
  // (no `locus`) it anchors to the whole track.
  track?: string
  // '8:127,735,434' or '8:127,700,000-127,800,000' — 1-based, commas optional,
  // aliases resolved through the assembly (so 'chr8' works on a bare-named
  // assembly). Without `track` the view's whole tracks area is used.
  locus?: string
  // where in the track's height to put the anchor point: 0 = top, 1 = bottom.
  // Omit to anchor to the whole track band (what a `box` wants).
  //
  // A fraction only means something when the track FITS the capture. A display
  // taller than the viewport runs off the bottom edge, and a fraction of its
  // height then lands outside the frame — there, use `fracY: 0` with a `dy`, so
  // the offset is measured down from the track's top edge (see
  // `tcga/cohort_cnv_genome`, ~1105px of stack in a 1120px viewport).
  fracY?: number
  // px nudge off the resolved position, for readability only — separating two
  // labels whose loci are a few px apart, or lifting an arrow tail clear of the
  // pill it leaves from. On the annotation's primary `anchor` this is equivalent
  // to the annotation's own `dx`/`dy`; on `fromAnchor` it is the only way to
  // nudge the tail.
  dx?: number
  dy?: number
}

// A callout drawn over the captured page (SVG overlay) before the screenshot,
// to reproduce the red arrows / boxes / text labels that hand-made teaching
// figures use. Coordinates are viewport CSS px.
//
// Prefer `anchor` over raw x/y in every case: an anchored callout resolves its
// geometry at capture time, a hand-tuned coordinate goes stale silently.
// `dx`/`dy` nudge the anchored position.
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
  // CSS px (default 420). A newline in `text` is a hard break — so a callout can
  // author a list — and each line still wraps to maxWidth on its own; a blank
  // line becomes a paragraph gap.
  maxWidth?: number
  fontSize?: number // text/circle label, default 22 for text (min 18)
  strokeWidth?: number // box/circle stroke width (default 5); arrow line+head (default 4)
  fillOpacity?: number // box: tint the interior with a translucent wash of color
  anchor?: AnnotationAnchor
  // for 'arrow' with an anchored head: the tail can be anchored too, so a
  // callout's whole geometry is model-derived. Same shape as `anchor`; `from`
  // is the raw-pixel fallback.
  fromAnchor?: AnnotationAnchor
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
  // height for this frame alone, applied after its actions run. The spec's own
  // viewportHeight has to cover the tallest state, which leaves every shorter
  // one padded with page background — an open context menu needs twice the
  // frame the view it launches does. Width is deliberately not per-stage: the
  // frames are stacked with `-append`, which needs one width.
  viewportHeight?: number
}

// Fields every spec shares, whatever produces its PNG. Kept apart from
// CommonSpecFields (which is browser-capture-only) so the generator can read
// them off a bare ScreenshotSpec without narrowing by mode first.
export interface BaseSpecFields {
  name: string
  // committed PNG is a hand-curated / real-human-data screenshot the spec body
  // can't reproduce; the generator skips it so a regen never clobbers it
  curated?: boolean
  // spec reproduces fine but pulls so much remote data that a routine regen is
  // more likely to time out than to produce a new image. Skipped in an
  // unfiltered run; still rendered when named in --filter, so it stays
  // regenerable on purpose rather than by luck. No spec sets it today —
  // gallery/hg002_dipcall was the last one, and rehosting a slice of the two
  // 1GB dipcall BAMs was the better fix than skipping it.
  heavyNetwork?: boolean
  // per-spec override of the content-stable diff gate (fraction of pixels in
  // [0,1]). Raise it for specs with irreducible render jitter — remote-data
  // timing, heavy text, animated chrome — so an unchanged capture isn't
  // re-committed every regen. Prefer making the capture reproducible first;
  // reach for this only when the jitter can't be designed out. Defaults to the
  // global DEFAULT_DIFF_THRESHOLD.
  diffThreshold?: number
}

export interface CommonSpecFields extends BaseSpecFields {
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
  // CSS selectors for transient chrome to hide just before capture (e.g. a MUI
  // snackbar toast or the hover tooltip left over from driving a menu):
  // `['.MuiSnackbar-root', '.MuiTooltip-popper']`. Each matched element is
  // `display:none`'d. Use for UI that a click sequence necessarily triggers but
  // shouldn't appear in the final frame.
  hideSelectors?: string[]
  // render this spec with the Firefox backend instead of Chrome. Headless
  // Chrome's swiftshader rasterizes some WebGL/molstar content (e.g. the
  // protein3d structure canvas) as a featureless blob with no visible
  // selection; headless Firefox renders it cleanly. The CLI `--firefox` flag
  // forces every spec onto Firefox; this opts a single spec in for normal regens
  firefox?: boolean
  // crop the capture to this CSS-px rect (ignored by embedded specs, which
  // screenshot the component element directly)
  crop?: { x: number; y: number; width: number; height: number }
  // substrings of browser console errors this spec is EXPECTED to emit, so the
  // generator suppresses them instead of printing them as alarming
  // browser[error] lines. Use only for specs whose subject IS an error/empty
  // state (e.g. the config-not-found landing page, or an assembly-manager shot
  // captured over a view with no assembly). Anything not listed still surfaces.
  expectedConsole?: string[]
  // by default the generator fails a capture that still shows a visible loading
  // overlay, an error banner, or a region-too-large message at shoot time (a
  // silently-saved "Loading" PNG is the failure mode this guards against). Set
  // true only for specs whose subject IS such a state (an error landing page, a
  // deliberately-too-large view), so the guard doesn't flag the intended content.
  allowUnsettled?: boolean
}

// Navigate directly to a session spec URL. Every browser-rendered spec uses this
// mode (multi-view layouts, single LGVs, everything); the session is built
// declaratively via the helpers in screenshot-spec-helpers.ts.
export interface SessionUrlSpec extends CommonSpecFields {
  mode: 'url'
  url: string // full query string starting with '?' or a full URL
  readyText?: string // text to wait for before settle
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
  waitUntil?: 'networkidle0' | 'domcontentloaded' // override goto waitUntil
  settleMs?: number
  actions?: ScreenshotAction[]
}

// Invoke the @jbrowse/img CLI (jb2export) directly. These produce the
// products/jbrowse-img/README example images — React SSR renders straight to
// SVG/PNG with no browser involved, so they regenerate from plain jb2export
// args instead of the URL-mode puppeteer machinery, and land in
// products/jbrowse-img/img/ rather than website/static/img/.
export interface CliSpec extends BaseSpecFields {
  mode: 'cli'
  // 'jbrowse-img/<basename>'; basename matches the .png in products/jbrowse-img/img/
  name: string
  args: string[] // jb2export args; the generator appends `--out <tmpfile>`
}

// Render the embedded `@jbrowse/react-linear-genome-view2` component itself (not
// the jbrowse-web app) via its prebuilt UMD bundle, the exact script-tag setup
// the embed tutorial documents. The generator serves a tiny harness page that
// calls `createViewState(viewState)` and mounts `<JBrowseLinearGenomeView>`,
// then screenshots the component element. Use for figures that must show the
// embedded component rather than the full app.
//
// NOTE: this mode screenshots the `#root` element directly and does NOT run the
// shared `shoot` path, so the CommonSpecFields that only take effect there
// (annotations, crop, hideSelectors, hideTooltip, stages) are ignored here.
export interface EmbeddedSpec extends CommonSpecFields {
  mode: 'embedded'
  // the object passed verbatim to the UMD's `createViewState(...)` (assembly /
  // tracks / defaultSession / location). Must be plain JSON — it is serialized
  // into the harness page, so no functions / jexl callbacks.
  viewState: object
  readyText?: string // text to wait for before settle (e.g. a track label)
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
  settleMs?: number
}

// Stack already-rendered PNGs into one combined figure. Each `parts`
// entry is another spec's name; the generator reads those specs' committed
// static/img/<name>.png files and `convert -append`s them (top to bottom) into
// <name>.png. It runs after the browser/cli specs so the parts are freshly
// rendered first. Use this to assemble a before/after figure from two
// independent DECLARATIVE specs (e.g. one session per setting) rather than an
// imperative `stages` capture that drives the menu — the combined image then
// can't drift from either state, and each state stays an openable live link.
//
// A part is machinery, not a published figure: no doc references
// `/img/<part>.png` (the doc shows the stack and reaches each state through
// `<Figure links=...>`), so the review UI folds parts into their parent's card
// rather than listing them as figures of their own, and the generator recomposes
// the parent whenever a --filter selects one of its parts.
export interface ComposeSpec extends BaseSpecFields {
  mode: 'compose'
  parts: string[] // spec names whose static/img PNGs are stacked, top to bottom
  // 'horizontal' places the parts side by side (`+append`) instead of stacking
  // them. Use it when the two states are the SAME view drawn two ways and a
  // reader compares them across rather than down — the layout pair, where
  // stacking makes the second look like the next step rather than the
  // alternative. The parts then have to share a HEIGHT rather than a width.
  direction?: 'vertical' | 'horizontal'
}

export type BrowserScreenshotSpec = SessionUrlSpec | EmbeddedSpec
export type ScreenshotSpec = BrowserScreenshotSpec | CliSpec | ComposeSpec
