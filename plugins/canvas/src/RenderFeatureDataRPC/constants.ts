// Base pixel size every label is MEASURED at. The worker is display-mode
// agnostic (so compact toggles never refetch), so every `LabelItem.textWidth` is
// measured here, but compact modes DRAW at labelFontSize(displayMode) =
// LABEL_FONT_SIZE × LABEL_FONT_MULTIPLIERS. Convert with renderedTextWidth
// before using a baked width for anything geometric.
export const LABEL_FONT_SIZE = 11

// How much smaller the isoform badge draws than the name it sits beside. It is
// an aside on the gene's label, not a second label, so it recedes — with the
// italic and the muted grey the badge also takes (see floatingLabelMore and
// createMoreIsoformsLabel).
//
// A DRAWING size, and the badge's baked `textWidth` is measured at
// `LABEL_FONT_SIZE × this` for that reason: `renderedTextWidth` below is linear,
// so every reservation that converts a baked width — the packer's overhang, the
// hit box, the highlight overlay, the SVG export's boxes — then lands on the
// width the badge actually paints without any of them knowing there is a second
// size in play. Scaling at the reservation sites instead would have been four
// multiplies to keep in step, three of which fail silently by over-reserving.
export const MORE_ISOFORMS_FONT_SCALE = 0.85

// A baked textWidth converted to the width it actually paints at `fontSize`.
// Text width scales linearly with font size for a fixed string, so this single
// multiply is the whole conversion, and it's the one every consumer of a baked
// width owes, because measuring at 11px and drawing at 7.7px (superCompact)
// otherwise overstates by 43%. That overstatement made the packer reserve label
// overhang no label needed (thinning rows in the mode chosen for density), made
// the fitWidth decimation drop names that had room, widened hit and
// hover/selection boxes past the drawn text, and left the SVG export's overlay
// backing rect wider than the DOM one it is supposed to mirror.
export function renderedTextWidth(textWidth: number, fontSize: number) {
  return textWidth * (fontSize / LABEL_FONT_SIZE)
}

// Horizontal breathing room added to each label's reserved layout span so two
// labels packed onto the same row never abut. Also absorbs small discrepancies
// between measureText's Helvetica width table and the actually-rendered font,
// which otherwise let neighboring labels overlap by a few pixels.
export const LABEL_PADDING_PX = 6

// Max rendered width of a description label. Enforced by truncating the text to
// this width at creation, so the stored textWidth is bounded by construction and
// layout/hit-test reservations always match what is drawn.
export const MAX_DESCRIPTION_LABEL_WIDTH_PX = 200

// How far in from the left edge of the drawing area a label is held when its
// feature runs off that edge. A gene wider than the window has no on-screen
// start to hang its name from, so the name is clamped to where the drawing
// begins — at 0 that puts the text against the panel border, or against the
// neighbouring panel in a synteny or breakpoint-split row, and it reads as
// clipped rather than as pinned. Small enough not to move a label whose feature
// genuinely starts near the edge by anything a reader would notice.
export const LABEL_EDGE_GUTTER_PX = 4

// Translucent light backing rect drawn behind an "overlay"-style label so its
// (theme.palette.common.black) text stays readable over the colored feature box.
// Single source so the on-screen DOM overlay and the SVG export use the same
// backing. Not a theme token — a fixed translucent white that works over any
// feature fill.
export const LABEL_OVERLAY_BACKGROUND = 'rgba(255,255,255,0.65)'

// Where a label's alphabetic baseline sits below the top of its box, as a
// fraction of the font size. Labels are POSITIONED by their top edge (labelY,
// from computeLabelPosition), which is what the on-screen DOM overlay wants: a
// `line-height: 1` div puts the baseline at half-leading + ascent =
// (1 - (ascent + descent))/2 + ascent below its top. For the sans-serif faces
// in play (Roboto 0.928/0.244, Helvetica/Arial 0.905/0.212) that lands within a
// hair of 0.84 either way. Canvas fillText takes the BASELINE, so the SVG
// export has to convert; drawing at labelY + fontSize (the box bottom) instead
// sat every exported label ~1.8px below its on-screen position, pushing
// descenders out of the backing rect and eating into the row gap the packer
// reserved.
export const LABEL_BASELINE_RATIO = 0.84
