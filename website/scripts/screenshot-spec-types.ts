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

// One frame of a multi-stage figure, captured after this stage's actions run.
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
  // frame the view it launches does.
  viewportHeight?: number
}

// How a figure of several frames, a compose spec's parts or a staged spec's
// stages, lays them out, in the composition's own px (2x for an app capture, 1x
// for a CLI part). The spec's `annotations` draw over the result.
export interface FrameLayout {
  // frames per row; 1 stacks them. Side by side suits two drawings of one view,
  // which stacked read as consecutive steps. A row top-aligns its frames, so
  // they should share a height.
  columns?: number
  // white space between the frames: 24 in rows, 0 stacked. A stack wants one
  // for a `trapezoid` joining two frames, whose edges otherwise share a line.
  gutter?: number
  // white columns down both sides of a stack, for a `trapezoid` from the first
  // region of a row, which the image edge would otherwise clip
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

export interface CommonSpecFields extends BaseSpecFields, FrameLayout {
  // capture-viewport height in CSS px (DEFAULT_VIEWPORT otherwise); raise it
  // for tall multi-row pileups so the track isn't clipped
  viewportHeight?: number
  // capture-viewport width in CSS px (DEFAULT_VIEWPORT otherwise); raise it for
  // wide multi-panel layouts (dotplot/synteny/whole-genome) that get cut off
  viewportWidth?: number
  // callouts drawn over the page before capture (arrows/boxes/text/circles);
  // with `stages`, over the arranged frames as on a compose spec, each frame
  // anchorable as `[data-part="N"]`
  annotations?: Annotation[]
  // multi-stage figure: each stage is captured and the frames arranged by the
  // spec's FrameLayout. A per-stage `viewportHeight` is how a grid trims the
  // blank under its shorter row.
  stages?: ScreenshotStage[]
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

// Arrange already-rendered PNGs into one figure. Each `parts` entry is another
// spec's name; the generator reads its committed static/img/<name>.png after
// the browser and CLI specs have rendered. A before/after built from two
// declarative specs, one session per setting, has states that cannot drift and
// each open as a live link.
//
// No doc shows a part on its own. The doc reaches each state through
// `<Figure links=...>`, the review UI folds parts into their parent's card, and
// a --filter on a part recomposes the parent.
//
// `annotations` draw over the finished composition, the only kind a jb2export
// part can have. They anchor to a part, `{ selector: '[data-part="1"]' }` plus
// alignX/alignY/dx/dy, never inside one: anything pointing at a locus belongs
// on the part's own spec. An arrow can cross the seam, but a numbered `circle`
// on each part, or the app's own label, says it without a line across the
// gutter.
export interface ComposeSpec extends BaseSpecFields, FrameLayout {
  mode: 'compose'
  parts: string[]
  annotations?: Annotation[]
}

export type BrowserScreenshotSpec = SessionUrlSpec | EmbeddedSpec
export type ScreenshotSpec = BrowserScreenshotSpec | CliSpec | ComposeSpec
