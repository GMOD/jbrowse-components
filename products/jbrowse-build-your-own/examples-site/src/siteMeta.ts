// per-site chrome config consumed by the shared Shell layout
export const componentLabel = 'Build Your Own'
export const mainMaxWidth = '1400px'
export const demoFillHeight = false

// The example the landing page runs live, above the fold, rather than describing.
export const landingDemo = 'pan-and-zoom'

// What each demo settles at, in px. Every demo here is `client:only`, so the
// server sends an empty `<div class="demo">` — `astro-island` is
// `display: contents` and adds no box of its own — and the browser fetches
// ~460 KB of engine before anything fills it. Without a reservation that box is
// 0 high until then and everything below it jumps down when the demo arrives.
//
// These are measured rather than guessed. Most are exact and hold at any width,
// because a display's height comes from its track config; the exception is a
// demo whose own controls wrap, which is taller at narrow widths — reserve the
// **tallest** it gets, since a reservation that is too small jumps the page and
// one that is too large only leaves space inside the demo's own border.
// `drive-it-from-your-app` is the one here: 253px wide, 286px once its control
// row wraps.
//
// `pnpm smoke` re-measures every demo with its reservation neutralised and
// fails on both edges, tightly when a demo outgrows its box and loosely when it
// is far under. Numbers that rot are worse than no numbers: the page then jumps
// in whichever direction the figure is stale.
//
// A demo whose height depends on its *data* — anything in a fit-height mode —
// cannot be pinned this way at all. Reserve the common case and accept the
// shift, or give that one a fixed-height box.
export const demoHeights: Record<string, number> = {
  'pan-and-zoom': 155,
  'one-track': 102,
  'a-stack-of-tracks': 372,
  'bring-your-own-overlays': 331,
  'add-the-chrome-you-want': 406,
  'drive-it-from-your-app': 286,
  'your-own-feature-details': 182,
  'run-it-in-a-worker': 372,
}
