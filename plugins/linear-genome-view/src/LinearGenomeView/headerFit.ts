// Widths measured against a built jbrowse-web at the default theme and root
// font size — `products/jbrowse-web/browser-tests/probe-lgv-header-fit.ts`
// prints the row piece by piece. It spends 591px on everything that is not the
// search box (47 track selector, 114 scroll-zoom toggle, 156 pan buttons, 50 bp
// readout, 192 zoom controls, 32 of flex gap), and the search box asks for
// 189px including its margins before flexbox starts squeezing it. So below
// 780px something in the row has to give.
//
// A much larger root font — the header's own styles cite a 28px one — widens
// the text and the icons without widening the fixed-px slider or MUI's 64px
// button minimum, so no single factor rescales this table. There the row sheds
// later than it should and the search box is squeezed the way it was before any
// of this, which is a degradation rather than a new failure.
const ROW_WITHOUT_SEARCH_PX = 591
const SEARCH_BOX_PX = 189

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
 * room for, given whether the clear-highlights button is currently in the row.
 * An unmeasured width — the first render, before the ResizeObserver has
 * reported — keeps all of them, so the common wide case paints its final form
 * immediately rather than flashing the compact one.
 *
 * Below 427px even the fully shed row overflows, and from there the search box
 * shrinks like any flex item. That is a floor, not a cliff: it shrinks from the
 * 189px it was protected at rather than from the 101px the unshed row used to
 * leave it. jbrowse-web stops narrowing at a 400px header, where the box
 * measures 158px.
 */
export function headerFit(
  width: number | undefined,
  clearHighlight = false,
): HeaderFit {
  const fit = Object.fromEntries(SHEDDABLE.map(([k]) => [k, true])) as HeaderFit
  if (width === undefined) {
    return fit
  }
  const room = width - (clearHighlight ? CLEAR_HIGHLIGHT_PX : 0)
  let need = ROW_WITHOUT_SEARCH_PX + SEARCH_BOX_PX
  for (const [key, saves] of SHEDDABLE) {
    if (need <= room) {
      break
    }
    fit[key] = false
    need -= saves
  }
  return fit
}
