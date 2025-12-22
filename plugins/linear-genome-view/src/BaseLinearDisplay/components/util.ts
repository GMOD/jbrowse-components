/**
 * Get the left edge of the viewport in pixels.
 * When scrolled left (offsetPx < 0), viewport starts at 0.
 * When scrolled right (offsetPx > 0), viewport starts at offsetPx.
 */
export function getViewportLeftEdge(offsetPx: number): number {
  return Math.max(0, offsetPx)
}

/**
 * Clamp feature positions to be within the visible viewport.
 * Prevents labels from being positioned in off-screen areas.
 */
export function clampToViewport(
  featureLeftPx: number,
  featureRightPx: number,
  offsetPx: number,
): { leftPx: number; rightPx: number } {
  const viewportLeft = getViewportLeftEdge(offsetPx)
  return {
    leftPx: Math.max(featureLeftPx, viewportLeft),
    rightPx: Math.max(featureRightPx, viewportLeft),
  }
}
