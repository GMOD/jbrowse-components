// Base pixel size every label is MEASURED at. The worker is display-mode
// agnostic (so compact toggles never refetch), so every `LabelItem.textWidth` is
// measured here, but compact modes DRAW at labelFontSize(displayMode) =
// LABEL_FONT_SIZE × LABEL_FONT_MULTIPLIERS. Convert with renderedTextWidth
// before using a baked width for anything geometric.
export const LABEL_FONT_SIZE = 11

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

// Translucent light backing rect drawn behind an "overlay"-style label so its
// (theme.palette.common.black) text stays readable over the colored feature box.
// Single source so the on-screen DOM overlay and the SVG export use the same
// backing. Not a theme token — a fixed translucent white that works over any
// feature fill.
export const LABEL_OVERLAY_BACKGROUND = 'rgba(255,255,255,0.65)'
