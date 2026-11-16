export const PILEUP_SHOWN_HEIGHT = 250
export const PILEUP_HIDDEN_HEIGHT = 100

/**
 * The `height` slot as written, else the height the track opens at: room for
 * a pileup while it shows, and while it is hidden a compact band stack.
 */
export function resolvedTrackHeight(
  height: number | undefined,
  showPileup: boolean,
) {
  return height ?? (showPileup ? PILEUP_SHOWN_HEIGHT : PILEUP_HIDDEN_HEIGHT)
}
