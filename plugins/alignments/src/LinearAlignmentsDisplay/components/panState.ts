// The LGV's click-drag pan (`useSideScroll`) publishes its state as attributes
// on the tracks container: one while the button is down, one once the press has
// travelled far enough to be a pan rather than a click. Its own module so an
// SVG overlay can ask without importing the canvas hook's graph.
export const PAN_DRAGGING = '[data-pan-dragging]'
export const PAN_MOVED = '[data-pan-moved]'
