// Widths measured against a built jbrowse-web at the default theme and root
// font size — `products/jbrowse-web/browser-tests/probe-lgv-header-fit.ts`
// prints the row piece by piece. It spends 591px on everything that is not the
// search box (47 track selector, 114 scroll-zoom toggle, 156 pan buttons, 50 bp
// readout, 192 zoom controls, 32 of flex gap). What the box itself asks for is
// the caller's, because it follows the locstring rather than being a constant.
const ROW_WITHOUT_SEARCH_PX = 591

// The one piece of the row that comes and goes on its own. A text search that
// lands on a feature raises it — the same flow that was just using the search
// box this whole table exists to protect — so its width is taken off the top
// rather than left for the search box to absorb.
const CLEAR_HIGHLIGHT_PX = 35

// What the header gives up as its window narrows, cheapest first, with the
// pixels each one frees. Whitespace goes before words, words before a redundant
// control, and that before a readout. The search box is not on the list: it is
// the one control in the row with no equivalent anywhere else in the view, so
// everything else exists to keep it on screen.
const SHEDDABLE = [
  ['trackSelectorIndent', 16],
  ['panButtonSpacing', 100],
  ['scrollZoomLabel', 83],
  ['zoomSlider', 100],
  ['regionWidth', 54],
] as const

export type HeaderFit = Record<(typeof SHEDDABLE)[number][0], boolean>

/**
 * Which of the header bar's optional pieces a header `width` px wide still has
 * room for, given what the search box is asking for — `searchBoxWidth`, margins
 * included — and whether the clear-highlights button is currently in the row.
 * An unmeasured width — the first render, before the ResizeObserver has
 * reported — keeps all of them, so the common wide case paints its final form
 * immediately rather than flashing the compact one.
 *
 * `searchBoxPx` is the box's ask and not its floor, because the two differ by
 * the locstring — 189px empty, 194 at `ctgA:1..20,000`, 284 at
 * `chr22:10,510,000..10,610,000`. Shedding against the floor is what left
 * flexbox squeezing the box this whole table exists to protect: against the
 * floor the probe read 184px of an asked 210 at an 800px window and 186 at 600.
 *
 * The fully shed row costs 238px, so under `238 + searchBoxPx` the row overflows
 * whatever it gives up and the box shrinks like any flex item. That is a floor,
 * not a cliff: it shrinks from what it asked for rather than from the 101px the
 * unshed row used to leave it.
 */
export function headerFit({
  width,
  searchBoxPx,
  clearHighlight = false,
}: {
  width: number | undefined
  searchBoxPx: number
  clearHighlight?: boolean
}): HeaderFit {
  const fit = Object.fromEntries(SHEDDABLE.map(([k]) => [k, true])) as HeaderFit
  if (width === undefined) {
    return fit
  }
  const room = width - (clearHighlight ? CLEAR_HIGHLIGHT_PX : 0)
  let need = ROW_WITHOUT_SEARCH_PX + searchBoxPx
  for (const [key, saves] of SHEDDABLE) {
    if (need <= room) {
      break
    }
    fit[key] = false
    need -= saves
  }
  return fit
}
