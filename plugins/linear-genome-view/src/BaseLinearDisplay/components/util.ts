import { clamp } from '@jbrowse/core/util'

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

/**
 * Calculate the x position for a floating label.
 *
 * Floating labels have two modes:
 * 1. If the label is wider than the feature, it uses a fixed position
 *    (doesn't float) and can extend beyond the feature's right edge.
 * 2. If the label fits within the feature, it floats to stay visible
 *    but is constrained to keep its right edge within the feature's right edge.
 *
 * @param featureLeftPx - Left edge of the feature in pixels
 * @param featureRightPx - Right edge of the feature in pixels
 * @param labelWidth - Width of the label text in pixels
 * @param offsetPx - Current viewport offset in pixels
 * @param viewportLeft - Left edge of the viewport in pixels
 * @returns The x position for the label (already offset-adjusted)
 */
export function calculateFloatingLabelPosition(
  featureLeftPx: number,
  featureRightPx: number,
  labelWidth: number,
  offsetPx: number,
  viewportLeft: number,
): number {
  const featureWidth = featureRightPx - featureLeftPx

  if (labelWidth > featureWidth) {
    // Label doesn't fit within feature - don't float, use fixed position
    return featureLeftPx - offsetPx
  }

  // Label fits within feature - apply floating logic
  const leftPx = Math.max(featureLeftPx, viewportLeft)
  const naturalX = leftPx - offsetPx
  const maxX = featureRightPx - offsetPx - labelWidth
  return clamp(naturalX, 0, maxX)
}
