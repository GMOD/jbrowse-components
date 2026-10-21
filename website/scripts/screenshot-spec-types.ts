import type { KeyInput } from 'puppeteer'

// The callout vocabulary is @jbrowse/capture's, shared with the desktop
// selenium harness and with a reader's own `jb2capture --annotations`, so it is
// defined once next to the drawing code rather than here. Type-only, so live
// link generation importing this module loads no puppeteer.
export type { Annotation, AnnotationAnchor } from '@jbrowse/browser-test-utils'

import type { Annotation, AnnotationAnchor } from '@jbrowse/browser-test-utils'

// An action's anchor: everything a callout's resolves, plus the kinds only a
// click or a drag needs. The generator resolves these itself (chordAnchor.ts,
// locusAnchor.ts), and @jbrowse/capture, which draws callouts and clicks
// nothing, does not.
export interface ActionAnchor extends AnnotationAnchor {
  // Part of a circular view chord's own `<title>` -- the record's name and both
  // of its loci, e.g. 'SV_20'. Hit-tested along the curve rather than measured:
  // a chord is a Bezier, so its bounding-box centre is not on it, and its
  // midpoint is where every other chord bundles.
  chord?: string
  // A circular view chromosome's ideogram band, by refName ('chr11'), or with
  // its assembly when two genomes share names ('mm39 chr11'), placed at the
  // band's middle and checked against the view's own `bandAt`.
  ideogram?: string
  // A selector, matched INSIDE the view, whose vertical band the point lands in
  // — the third way of choosing the y after `trackId` and the default tracks
  // area. The x still comes from the locus, which is what makes it useful: the
  // scalebar a rubberband is drawn on spans exactly the tracks' x-range and
  // sits above them, so `{ loc, band: '[data-testid="rubberband_controls"]' }`
  // is a drag on the ruler with no measured pixel in it.
  band?: string
}

interface Point {
  x: number
  y: number
}

// What a one-point action acts on: an element by `selector` or visible `text`,
// or a point. A point resolves from `anchor` against the live model; `from` is
// a viewport pixel, correct only at the width, locus and layout it was measured
// against.
export interface ActionTarget {
  selector?: string
  text?: string
  anchor?: ActionAnchor
  from?: Point
  // the wait for the target, overriding FIND_TIMEOUT
  timeout?: number
}

export type ScreenshotAction =
  | ({ type: 'click' } & ActionTarget)
  | ({ type: 'rightclick' } & ActionTarget)
  | ({ type: 'hover' } & ActionTarget)
  // centers the target in its nearest horizontally-scrollable ancestor
  | ({ type: 'scroll' } & ActionTarget)
  | ({
      type: 'type'
      value: string
      // replace the field's content rather than appending to it
      clear?: boolean
      // ms between keystrokes; unset types the value in one go
      typeDelayMs?: number
      // insert the value as one input event, as a paste does
      paste?: boolean
    } & ActionTarget)
  // A rubberband pairs a `loc` with a `band` naming the strip to drag on:
  // `fromAnchor: { loc: 'ctgA:4000', band: RUBBERBAND }`. Each anchor takes
  // precedence over its pixel twin.
  | {
      type: 'drag'
      from?: Point
      to?: Point
      fromAnchor?: ActionAnchor
      toAnchor?: ActionAnchor
      timeout?: number
    }
  // a puppeteer key name, for keyboard-only widgets such as the search
  // autocomplete, which ignores synthetic option clicks
  | { type: 'press'; key: KeyInput }
  | {
      type: 'waitForSelector'
      selector: string
      hidden?: boolean
      timeout?: number
    }
  | { type: 'waitForText'; text: string; hidden?: boolean; timeout?: number }
  // Waits until the app reports its work finished and holds that for `holdMs`.
  // Use it for anything an action started: a navigation, a launch, a refetch.
  | { type: 'waitForAppSettled'; holdMs?: number; timeout?: number }
  // For chrome the app says nothing about: a menu animation, a tooltip delay.
  | { type: 'delay'; ms: number }

// Parks the mouse on the JBrowse wordmark, an svg with no handlers, so no
// hover readout or tooltip is left in the capture.
export const PARK_CURSOR = {
  type: 'hover',
  selector: '[aria-label="JBrowse"]',
} satisfies ScreenshotAction

// One frame of a multi-stage figure. The page is captured after this stage's
// actions run; the frames are stacked vertically (ImageMagick `-append`) into a
// single image, replacing the hand-run `convert -append` teaching figures.
export interface ScreenshotStage {
  actions?: ScreenshotAction[]
  annotations?: Annotation[]
  // Load this session URL for the stage instead of continuing from the state
  // the previous stage left. For the frame of a multi-stage figure that is a
  // RESULT rather than a step: the end state is declared as a session spec and
  // loaded, rather than clicked together through the UI — which is both fewer
  // moving parts and the only way to set things a spec can write but a menu
  // can't reach (per-track heights on a view the app creates at click time).
  // The stage's frame is still composed into the same figure. `readySelector`
  // goes with it: a stage that opens a different view type than the spec's
  // first page needs its own ready gate.
  url?: string
  readySelector?: string
  // press Escape before this stage's actions to dismiss a menu/popover the
  // previous stage left open
  closeMenusFirst?: boolean
  // dismiss the menu cascade after this stage's actions, before its frame is
  // captured. For a stage whose subject is the RESULT of a menu setting rather
  // than the menu: a checkbox/radio row leaves its menu standing, so without
  // this the frame is of the open menu over the thing it just changed.
  closeMenusAfter?: boolean
  // height for this frame alone, applied after its actions run. The spec's own
  // viewportHeight has to cover the tallest state, which leaves every shorter
  // one padded with page background — an open context menu needs twice the
  // frame the view it launches does. Width is deliberately not per-stage: the
  // frames are stacked with `-append`, which needs one width.
  viewportHeight?: number
}

// How a figure of several frames lays them out, in the composition's own px.
export interface FrameLayout {
  // frames per row; 1 stacks them
  columns?: number
  // white space between the frames: 24 in rows, 0 stacked
  gutter?: number
  // white columns down both sides of a stack
  sideMargin?: number
}

// Fields every spec shares, whatever produces its PNG. Kept apart from
// CommonSpecFields (which is browser-capture-only) so the generator can read
// them off a bare ScreenshotSpec without narrowing by mode first.
export interface BaseSpecFields {
  name: string
  // whether the LIVE session a reader opens is slow, overriding the timeouts
  // screenshotSlowSpecNames otherwise infers it from. Set it wherever a budget
  // is capture headroom rather than a claim about the reader: the Hi-C block
  // waits minutes because four of its specs render at once on a loaded sweep
  // machine, and opens in seconds in a browser that is only running one.
  slowLiveSession?: boolean
  // per-spec override of the content-stable diff gate (fraction of pixels in
  // [0,1]). Raise it for specs with irreducible render jitter — remote-data
  // timing, heavy text, animated chrome — so an unchanged capture isn't
  // re-committed every regen. Prefer making the capture reproducible first;
  // reach for this only when the jitter can't be designed out. Defaults to the
  // global DEFAULT_DIFF_THRESHOLD.
  diffThreshold?: number
}

export const DEFAULT_VIEWPORT = { width: 1500, height: 800 }

export interface CommonSpecFields extends BaseSpecFields {
  // capture-viewport height in CSS px (DEFAULT_VIEWPORT otherwise); raise it
  // for tall multi-row pileups so the track isn't clipped
  viewportHeight?: number
  // capture-viewport width in CSS px (DEFAULT_VIEWPORT otherwise); raise it for
  // wide multi-panel layouts (dotplot/synteny/whole-genome) that get cut off
  viewportWidth?: number
  // callouts drawn over the page before capture (arrows/boxes/text/circles)
  annotations?: Annotation[]
  // multi-stage figure: each stage is captured and the frames stacked vertically
  stages?: ScreenshotStage[]
  // lay the stage frames out in rows of this many instead of one column. A
  // four-stage walkthrough stacked vertically is four viewport heights of
  // figure, most of it the same app chrome four times; in rows of two it is a
  // quarter as tall and the frames are compared side by side. A row is
  // `+append`ed, so the stages sharing a row have to share a height (a per-stage
  // `viewportHeight` is fine between rows, and is how a grid trims the blank
  // under its shorter half).
  stageColumns?: number
  // callouts drawn over the finished stage composition, each stage anchorable
  // as `[data-part="N"]` — for a mark spanning two frames, which a stage's own
  // `annotations` cannot reach out of. Anchoring INSIDE a frame is not
  // available (the composition is a flat image); that belongs on the stage.
  gridAnnotations?: Annotation[]
  // gutter between the frames of a `stageColumns` grid, in CAPTURED px (2x, so
  // the default 24 is ~12 CSS px). Raise it for a `gridAnnotations` mark that
  // sits between the frames rather than over one.
  stageGutter?: number
  // A tooltip on screen at capture is reported unless the spec says what it
  // wants: 'hide' removes one a menu click left lingering, 'expect' says the
  // figure is about one and reports its absence.
  tooltip?: 'hide' | 'expect'
  // CSS selectors for transient chrome to hide just before capture (e.g. a MUI
  // snackbar toast or the hover tooltip left over from driving a menu):
  // `['.MuiSnackbar-root', '.MuiTooltip-popper']`. Each matched element is
  // `display:none`'d. Use for UI that a click sequence necessarily triggers but
  // shouldn't appear in the final frame.
  hideSelectors?: string[]
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
  // what the figure's live link is called, when "Open this view in JBrowse" is
  // not what clicking it does. Only an absolute-url spec can need this: a
  // session spec always opens a view, but a capture of a plain web page (the
  // genomes.jbrowse.org catalog pages) opens a page, and the default label
  // would be a false statement about where the link goes.
  liveLabel?: string
  // the page holds no JBrowse session to publish `[data-app-phase]` — a plain
  // web page, jbrowse-web's no-config landing, or a release older than the
  // census — so `readyText` or `readySelector` is its whole positive signal,
  // followed by network idle
  noSession?: boolean
  // the spec's `assembly` presets an import form rather than opening a view,
  // so the census has no open assembly to wait for
  formAssembly?: boolean
  readyText?: string // text to wait for before settle
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
  waitUntil?: 'networkidle0' | 'domcontentloaded' // override goto waitUntil
  actions?: ScreenshotAction[]
  // What the `actions` open over the view for the figure to show, as the noun
  // phrase the recipe dialog completes "The figure's clicks open …" with: "the
  // track menu", "the ribbon's tooltip". The dialog's capture command opens
  // the session and clicks nothing, so it says the command draws the view
  // under this, and leaves out the callouts anchored to it.
  clicksOpen?: string
  // What the `actions` change that the session does not hold, as the verb
  // phrase completing "The figure's clicks …": "close the legend", "sort the
  // rows by genotype at HGSV_1821". A change a session spec can express
  // belongs in `url` instead, so the capture command lands on the picture;
  // this is for the rest, and the dialog says its picture differs there.
  clicksChange?: string
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
// (annotations, crop, hideSelectors, tooltip, stages) are ignored here.
export interface EmbeddedSpec extends CommonSpecFields {
  mode: 'embedded'
  // the object passed verbatim to the UMD's `createViewState(...)` (assembly /
  // tracks / defaultSession / location). Must be plain JSON — it is serialized
  // into the harness page, so no functions / jexl callbacks.
  viewState: object
  readyText?: string // text to wait for before settle (e.g. a track label)
  readySelector?: string // CSS selector to wait for before settle
  readyTimeout?: number // ms override for the ready wait (default 30000)
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
// `annotations` here draw over the FINISHED composition, which is a different
// thing from a part's own annotations and is the only kind a part rendered by
// the jb2export CLI can have at all (React SSR straight to PNG — there is no
// page for the overlay to draw into). They anchor to a part rather than to
// anything inside one: the generator lays an element over each part's own box
// in the composed image, so `{ selector: '[data-part="1"]' }` plus the usual
// alignX/alignY/dx/dy is a real anchor and not a pixel measured off a previous
// capture. A part's box comes from that part's own dimensions, so it follows a
// re-render that changes them.
//
// Anchoring INSIDE a part is still not available — the composition is a flat
// image with no view model and no track elements in it — so anything that has
// to point at a locus belongs on the part's own spec, where it can. Two
// consequences worth knowing before reaching for this:
//
// - An arrow CAN now cross the seam, since both ends resolve in the same page.
//   That does not make it the first choice: where the two halves share a
//   landmark, a numbered `circle` on each part still says it without a line
//   across the gutter, and where the app already labels the landmark itself,
//   prefer that and drop the numbers.
// - Sizes are in the composition's OWN pixels, which for a CLI part is 1x — so
//   a `fontSize` that looks right on a 2x app capture reads half as large here.
export interface ComposeSpec extends BaseSpecFields {
  mode: 'compose'
  parts: string[] // spec names whose static/img PNGs are stacked, top to bottom
  // 'horizontal' places the parts side by side (`+append`) instead of stacking
  // them. Use it when the two states are the SAME view drawn two ways and a
  // reader compares them across rather than down — the layout pair, where
  // stacking makes the second look like the next step rather than the
  // alternative. The parts then have to share a HEIGHT rather than a width.
  direction?: 'vertical' | 'horizontal'
  // white space BETWEEN the parts, in the composition's own px. Defaults to 24
  // side by side and to 0 stacked, which is what every existing figure of each
  // kind was composed at.
  //
  // Stacked, it is opt-in because it is only ever wanted for one reason: a
  // `trapezoid` annotation joining the two parts needs somewhere to be drawn,
  // and with the parts flush its two horizontal edges are the same line. It is
  // inserted above each part after the first rather than as a border round each
  // one, so the figure gains no margin at its top or bottom.
  gutter?: number
  // white columns down the LEFT and RIGHT of a stacked composition, in the
  // composition's own px. Ignored side by side, where `padPanels` already
  // frames each panel.
  //
  // Opt-in for one reason, and it is the mirror of `gutter`'s: a `trapezoid`
  // whose narrow end is the FIRST region of the row above has a near-vertical
  // side at x = 0, which the image edge clips. The margin is where that side
  // gets drawn. It moves each part's box, so `annotateComposition` reads it
  // too — a callout anchored a margin's worth off its part is the failure
  // nothing would report.
  sideMargin?: number
  // callouts drawn over the composed image, anchored per part (see above)
  annotations?: Annotation[]
}

export type BrowserScreenshotSpec = SessionUrlSpec | EmbeddedSpec
export type ScreenshotSpec = BrowserScreenshotSpec | CliSpec | ComposeSpec
