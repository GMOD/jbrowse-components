// Pixel size used everywhere a label is measured, laid out, or rendered.
// Single source of truth so the worker's text-width measurements, the
// main-thread layout's row reservations, and the DOM/SVG renderers all agree.
export const LABEL_FONT_SIZE = 11

// Horizontal breathing room added to each label's reserved layout span so two
// labels packed onto the same row never abut. Also absorbs small discrepancies
// between measureText's Helvetica width table and the actually-rendered font,
// which otherwise let neighboring labels overlap by a few pixels.
export const LABEL_PADDING_PX = 6

// Max rendered width of a description label. Enforced by truncating the text to
// this width at creation, so the stored textWidth is bounded by construction and
// layout/hit-test reservations always match what is drawn.
export const MAX_DESCRIPTION_LABEL_WIDTH_PX = 200

// Translucent light backing rect drawn behind an "overlay"-style label so its
// (theme.palette.common.black) text stays readable over the colored feature box.
// Single source so the on-screen DOM overlay and the SVG export use the same
// backing. Not a theme token — a fixed translucent white that works over any
// feature fill.
export const LABEL_OVERLAY_BACKGROUND = 'rgba(255,255,255,0.65)'
