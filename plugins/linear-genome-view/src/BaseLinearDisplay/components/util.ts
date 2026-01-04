import { clamp } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FloatingLabelData, LayoutRecord } from '../types'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

interface PixelPositions {
  leftPx: number
  rightPx: number
}

export interface FeatureLabelData {
  leftPx: number
  rightPx: number
  topPx: number
  totalFeatureHeight: number
  floatingLabels: FloatingLabelData[]
  featureWidth: number
  totalLayoutWidth: number
}

/**
 * Calculate pixel positions for a feature given its BP coordinates.
 * Handles cases where one or both ends might be off-screen by estimating
 * positions based on feature width and bpPerPx.
 */
function calculateFeaturePixelPositions(
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  refName: string,
  left: number,
  right: number,
  bpPerPx: number,
): PixelPositions | undefined {
  const canonicalRefName = assembly?.getCanonicalRefName(refName) || refName

  const leftBpPx = view.bpToPx({
    refName: canonicalRefName,
    coord: left,
  })?.offsetPx

  const rightBpPx = view.bpToPx({
    refName: canonicalRefName,
    coord: right,
  })?.offsetPx

  if (leftBpPx !== undefined) {
    const rightEstimate =
      rightBpPx !== undefined ? rightBpPx : leftBpPx + (right - left) / bpPerPx
    return {
      leftPx: Math.min(leftBpPx, rightEstimate),
      rightPx: Math.max(leftBpPx, rightEstimate),
    }
  } else if (rightBpPx !== undefined) {
    const leftEstimate = rightBpPx - (right - left) / bpPerPx
    return {
      leftPx: Math.min(leftEstimate, rightBpPx),
      rightPx: Math.max(leftEstimate, rightBpPx),
    }
  }
  return undefined
}

/**
 * Calculate pixel positions for features that span multiple regions
 * (e.g., genes with collapsed introns where both ends are off-screen)
 */
function calculateMultiRegionPositions(
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  refName: string,
  left: number,
  right: number,
): PixelPositions | undefined {
  const canonicalRefName = assembly?.getCanonicalRefName(refName) || refName
  const visibleRegions = view.displayedRegions.filter(
    r => r.refName === canonicalRefName && r.start < right && r.end > left,
  )

  if (visibleRegions.length === 0) {
    return undefined
  }

  let minLeftPx = Infinity
  let maxRightPx = -Infinity

  for (const region of visibleRegions) {
    const regionStart = Math.max(left, region.start)
    const regionEnd = Math.min(right, region.end)

    const startPx = view.bpToPx({
      refName: canonicalRefName,
      coord: regionStart,
    })?.offsetPx

    const endPx = view.bpToPx({
      refName: canonicalRefName,
      coord: regionEnd,
    })?.offsetPx

    if (startPx !== undefined && endPx !== undefined) {
      minLeftPx = Math.min(minLeftPx, startPx, endPx)
      maxRightPx = Math.max(maxRightPx, startPx, endPx)
    }
  }

  if (minLeftPx === Infinity || maxRightPx === -Infinity) {
    return undefined
  }

  return { leftPx: minLeftPx, rightPx: maxRightPx }
}

function getFeaturePositions(
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  refName: string,
  left: number,
  right: number,
  bpPerPx: number,
): PixelPositions | undefined {
  return (
    calculateFeaturePixelPositions(
      view,
      assembly,
      refName,
      left,
      right,
      bpPerPx,
    ) || calculateMultiRegionPositions(view, assembly, refName, left, right)
  )
}

export function deduplicateFeatureLabels(
  layoutFeatures: {
    entries(): IterableIterator<readonly [string, LayoutRecord | undefined]>
  },
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  bpPerPx: number,
): Map<string, FeatureLabelData> {
  const featureLabels = new Map<string, FeatureLabelData>()

  for (const [key, val] of layoutFeatures.entries()) {
    if (!val?.[4]) {
      continue
    }

    const [left, topPx, right, , feature] = val
    const {
      refName,
      floatingLabels,
      totalFeatureHeight,
      actualTopPx,
      featureWidth,
      totalLayoutWidth,
      leftPadding,
    } = feature
    const effectiveTopPx = actualTopPx ?? topPx

    if (
      !floatingLabels ||
      floatingLabels.length === 0 ||
      !totalFeatureHeight ||
      featureWidth === undefined ||
      totalLayoutWidth === undefined
    ) {
      continue
    }

    const positions = getFeaturePositions(
      view,
      assembly,
      refName,
      left,
      right,
      bpPerPx,
    )

    if (!positions) {
      continue
    }

    const adjustedLeftPx = adjustLabelPositionForPadding(
      positions.leftPx,
      leftPadding,
    )

    const existing = featureLabels.get(key)
    if (!existing || adjustedLeftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx: adjustedLeftPx,
        rightPx: positions.rightPx,
        topPx: effectiveTopPx,
        totalFeatureHeight,
        floatingLabels,
        featureWidth,
        totalLayoutWidth,
      })
    }
  }

  return featureLabels
}

/**
 * Adjust label left position to account for strand arrow padding.
 * For reverse strand features, the arrow extends to the left of the body,
 * so the label should start at the body position (leftPx + leftPadding).
 */
export function adjustLabelPositionForPadding(
  leftPx: number,
  leftPadding?: number,
): number {
  return leftPx + (leftPadding ?? 0)
}

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
