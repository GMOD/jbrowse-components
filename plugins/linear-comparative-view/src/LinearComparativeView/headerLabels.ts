// Widths measured against a built jbrowse-web at the default theme and root
// font size — `products/jbrowse-web/browser-tests/probe-synteny-header-fit.ts`
// prints the row piece by piece.

// The six icon buttons the bar always draws, at 31px each, plus the 4px flex
// gap after each of them.
const ICON_ROW_PX = 210

// What the two words add: 83 for 'Zoom on scroll' — the same number
// LinearGenomeView's headerFit sheds it against — and 39 for 'Follow'.
const LABELS_PX = 122

// One row's locate control: a ~180px search box, the assembly name and bp
// readout beside it, and the 12px gap to the next row's. Counted for the last
// row too, so a longer assembly name than the volvox one it was measured on has
// somewhere to go.
const PER_ROW_SEARCH_PX = 275

/**
 * Whether the comparative header bar is wide enough to spell out its two
 * toggles, or has to fall back to their icons.
 *
 * The search strip is what the words are shed for, the same trade
 * LinearGenomeView's `headerFit` makes: the strip is the only way to navigate
 * from this header, and it is a flex item with `min-width: 0`, so it does not
 * push back — an unshed label comes straight out of the search boxes. What it
 * asks for scales with `searchRows`, which is one per genome row side by side,
 * one for the whole column when stacked, and none at all when the strip is
 * hidden.
 *
 * An unmeasured width — the first render, before the ResizeObserver has
 * reported — keeps the labels, so the common wide case paints its final form
 * rather than flashing the icons.
 */
export function showsHeaderLabels({
  width,
  searchRows,
}: {
  width: number | undefined
  searchRows: number
}) {
  return (
    width === undefined ||
    width >= ICON_ROW_PX + LABELS_PX + searchRows * PER_ROW_SEARCH_PX
  )
}
