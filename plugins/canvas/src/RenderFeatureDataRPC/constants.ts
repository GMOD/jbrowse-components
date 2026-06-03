// Pixel size used everywhere a label is measured, laid out, or rendered.
// Single source of truth so the worker's text-width measurements, the
// main-thread layout's row reservations, and the DOM/SVG renderers all agree.
export const LABEL_FONT_SIZE = 11

// Max rendered width of a description label. Enforced by truncating the text to
// this width at creation, so the stored textWidth is bounded by construction and
// layout/hit-test reservations always match what is drawn.
export const MAX_DESCRIPTION_LABEL_WIDTH_PX = 200
