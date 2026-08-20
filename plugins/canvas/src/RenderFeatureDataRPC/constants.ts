// Base pixel size every label is MEASURED at. The worker is display-mode
// agnostic (so a compact toggle never refetches), so every `LabelItem.textWidth`
// is baked here while compact modes DRAW at `labelFontSize(displayMode)`. Any
// geometric use of a baked width owes `renderedTextWidth` first.
export const LABEL_FONT_SIZE = 11

// How much smaller the isoform badge draws than the name beside it — an aside on
// the gene's label, not a second label. A DRAWING size, and the badge's baked
// `textWidth` is measured at `LABEL_FONT_SIZE ×` it for that reason: every
// reservation that converts a baked width then lands on what the badge paints
// without knowing a second size is in play.
export const MORE_ISOFORMS_FONT_SCALE = 0.85

// A baked textWidth converted to the width it paints at `fontSize`. Text width
// is linear in font size for a fixed string, so this multiply is the whole
// conversion — and every consumer of a baked width owes it: measuring at 11px
// and drawing at 7.7px (superCompact) overstates by 43%, which reserves label
// overhang no label needs, drops names that had room, and widens hit and
// highlight boxes past the drawn text.
export function renderedTextWidth(textWidth: number, fontSize: number) {
  return textWidth * (fontSize / LABEL_FONT_SIZE)
}

// Breathing room added to each label's reserved span so two on one row never
// abut. Also absorbs the small drift between measureText's Helvetica width table
// and the rendered font, which otherwise overlaps neighbours by a few pixels.
export const LABEL_PADDING_PX = 6

// Max rendered width of a description label, enforced by truncating at creation
// so the stored textWidth is bounded by construction.
export const MAX_DESCRIPTION_LABEL_WIDTH_PX = 200

// How far in from the drawing area's left edge a label is held when its feature
// runs off it. Not 0: that puts the text against the panel border — or against
// the neighbouring panel in a synteny row — where it reads as clipped rather
// than pinned.
export const LABEL_EDGE_GUTTER_PX = 4

// Translucent backing behind an "overlay"-style label so its dark text stays
// readable over the colored box. Deliberately not a theme token — a fixed
// translucent white that works over any feature fill — and single-sourced so the
// DOM overlay and the SVG export draw the same one.
export const LABEL_OVERLAY_BACKGROUND = 'rgba(255,255,255,0.65)'

// Where a label's alphabetic baseline sits below the top of its box, as a
// fraction of the font size. Labels are positioned by their TOP edge, which is
// what the DOM overlay wants; canvas `fillText` takes the baseline, so the SVG
// export converts with this. A `line-height: 1` div puts the baseline at
// `(1 - (ascent + descent))/2 + ascent` below its top, which for the sans-serif
// faces in play (Roboto 0.928/0.244, Helvetica 0.905/0.212) lands within a hair
// of 0.84 either way. Using the box bottom instead sat every exported label
// ~1.8px low, pushing descenders out of the backing rect.
export const LABEL_BASELINE_RATIO = 0.84
