// What Canvas2D's `lineWidth` and SVG's `stroke-width` both default to, so a
// thickness that is no width at all draws what an absent one would. Shared with
// `logThickness`, which answers it for the same reason.
export const FALLBACK_STROKE_PX = 1
