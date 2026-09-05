// Base pixel size every label is MEASURED at; compact modes DRAW at
// `labelFontSize(displayMode)`, so any geometric use of a baked width owes
// `renderedTextWidth` first.
export const LABEL_FONT_SIZE = 11

// How much smaller the isoform badge draws than the name beside it. The badge's
// `textWidth` is baked at `LABEL_FONT_SIZE ×` this, so a reservation converting
// a baked width lands on what the badge paints without knowing a second size is
// in play.
export const MORE_ISOFORMS_FONT_SCALE = 0.85

// Text width is linear in font size for a fixed string, so this multiply is the
// whole conversion. Skipping it overstates a superCompact label by 43%, which
// drops names that had room and widens hit boxes past the drawn text.
export function renderedTextWidth(textWidth: number, fontSize: number) {
  return textWidth * (fontSize / LABEL_FONT_SIZE)
}

// Breathing room so two labels on one row never abut. Also absorbs the drift
// between measureText's Helvetica width table and the rendered font.
export const LABEL_PADDING_PX = 6

// Enforced by truncating at creation, so the stored textWidth is bounded by
// construction.
export const MAX_DESCRIPTION_LABEL_WIDTH_PX = 200

// How far in from the drawing area's left edge a label is held when its feature
// runs off it. Not 0, which puts the text against the panel border where it
// reads as clipped rather than pinned.
export const LABEL_EDGE_GUTTER_PX = 4

// Deliberately not a theme token: a fixed translucent white readable over any
// feature fill, single-sourced so the DOM overlay and the SVG export match.
export const LABEL_OVERLAY_BACKGROUND = 'rgba(255,255,255,0.65)'

// Where a label's alphabetic baseline sits below the top of its box, as a
// fraction of the font size. Labels are positioned by their TOP edge for the
// DOM overlay's sake, and canvas `fillText` takes the baseline, so the SVG
// export converts with this.
export const LABEL_BASELINE_RATIO = 0.84
