export interface AimPoint {
  x: number
  y: number
}

export interface AimRect {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Whether a pointer at `point` is still on its way to `panel`.
 *
 * The region is a cone — a `<` lying open toward the panel — with its tip at
 * `apex`, the spot the pointer was at when the panel opened, and its mouth the
 * panel's whole near edge. Anywhere inside it the pointer is plausibly
 * traveling to the panel, however many rows of the parent menu that path
 * crosses; anywhere outside it the pointer is going somewhere else and the
 * panel can shut at once.
 *
 * The cone widens with distance, which is what makes it better than a delay:
 * one step off the parent row admits almost no vertical drift, while a pointer
 * most of the way across admits the panel's full height. A pointer heading
 * straight down the menu leaves it immediately at any speed, so nothing has to
 * be waited out.
 *
 * `panel` is read in viewport coordinates, the same frame `apex` and `point`
 * come from (`clientX`/`clientY`), so a scrolled page needs no correction.
 */
export function isAimedAtPanel(
  point: AimPoint,
  apex: AimPoint,
  panel: AimRect,
) {
  // whichever vertical edge faces the tip: MUI flips a submenu to the other
  // side of its row when the viewport has no room on the usual one
  const nearX =
    Math.abs(panel.left - apex.x) <= Math.abs(panel.right - apex.x)
      ? panel.left
      : panel.right
  const toPanel = nearX - apex.x
  if (toPanel === 0) {
    return true
  }
  // how far across the gap the pointer has come, clamped so that a pointer
  // beyond the near edge is judged against the panel's real extent rather than
  // a cone that keeps widening past it
  const crossed = Math.min((point.x - apex.x) / toPanel, 1)
  return (
    crossed > 0 &&
    point.y >= apex.y + (panel.top - apex.y) * crossed &&
    point.y <= apex.y + (panel.bottom - apex.y) * crossed
  )
}
