// Pixel size used everywhere a label is measured, laid out, or rendered.
// Single source of truth so the worker's text-width measurements, the
// main-thread layout's row reservations, and the DOM/SVG renderers all agree.
export const LABEL_FONT_SIZE = 11
