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
  // for 'waitForText'/'waitForSelector': override the default 30s wait
  // (FIND_TIMEOUT). Use for actions gated on real heavy compute (e.g. RPC
  // clustering over thousands of samples) that can legitimately run long,
  // especially on a slower CI runner.
  timeout?: number
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
  // CSS px (default 420). A newline in `text` is a hard break — so a callout can
  // author a list — and each line still wraps to maxWidth on its own; a blank
  // line becomes a paragraph gap.
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

export interface CommonSpecFields {
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
  // substrings of browser console errors this spec is EXPECTED to emit, so the
  // generator suppresses them instead of printing them as alarming
  // browser[error] lines. Use only for specs whose subject IS an error/empty
  // state (e.g. the config-not-found landing page, or an assembly-manager shot
  // captured over a view with no assembly). Anything not listed still surfaces.
  expectedConsole?: string[]
}

// Navigate directly to a session spec URL. Every browser-rendered spec uses this
// mode (multi-view layouts, single LGVs, everything); the session is built
// declaratively via the helpers in screenshot-spec-helpers.ts.
export interface SessionUrlSpec extends CommonSpecFields {
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

// Invoke the @jbrowse/img CLI (jb2export) directly. These produce the
// products/jbrowse-img/README example images — React SSR renders straight to
// SVG/PNG with no browser involved, so they regenerate from plain jb2export
// args instead of the URL-mode puppeteer machinery, and land in
// products/jbrowse-img/img/ rather than website/static/img/.
export interface CliSpec {
  mode: 'cli'
  name: string // 'jbrowse-img/<basename>'; basename matches the .png in products/jbrowse-img/img/
  args: string[] // jb2export args; the generator appends `--out <tmpfile>`
  curated?: boolean
  diffThreshold?: number
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

// Stack already-rendered PNGs into one combined figure. Each `parts`
// entry is another spec's name; the generator reads those specs' committed
// static/img/<name>.png files and `convert -append`s them (top to bottom) into
// <name>.png. It runs after the browser/cli specs so the parts are freshly
// rendered first. Use this to assemble a before/after figure from two
// independent DECLARATIVE specs (e.g. one session per setting) rather than an
// imperative `stages` capture that drives the menu — the combined image then
// can't drift from either state, and each state stays an openable live link.
export interface ComposeSpec {
  mode: 'compose'
  name: string
  parts: string[] // spec names whose static/img PNGs are stacked, top to bottom
  diffThreshold?: number
}

export type BrowserScreenshotSpec = SessionUrlSpec | EmbeddedSpec
export type ScreenshotSpec = BrowserScreenshotSpec | CliSpec | ComposeSpec
