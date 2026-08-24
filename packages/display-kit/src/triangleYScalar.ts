/**
 * Vertical squash factor for the fit-to-height triangle displays (HiC, LD).
 * A rotated contact matrix has a natural apex height of `triangleWidth / 2`;
 * when `squashToHeight` is on this stretches (or squashes) that apex into
 * `displayHeight`, otherwise it's identity. Kept on the main thread so a
 * resize only repaints — no worker refetch. Returns 1 for a degenerate
 * (zero-width) triangle so callers never divide by zero.
 */
export function computeTriangleYScalar({
  squashToHeight,
  displayHeight,
  triangleWidth,
}: {
  squashToHeight: boolean
  displayHeight: number
  triangleWidth: number
}): number {
  const triangleHeight = triangleWidth / 2
  return squashToHeight && triangleHeight > 0
    ? displayHeight / triangleHeight
    : 1
}
