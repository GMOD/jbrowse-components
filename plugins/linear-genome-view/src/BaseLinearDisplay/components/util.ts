import { clamp } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { FloatingLabelData, LayoutRecord } from '../types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

interface PixelPositions {
  leftPx: number
  rightPx: number
}

export interface FeatureLabelData {
  leftPx: number
  topPx: number
  totalFeatureHeight: number
  floatingLabels: FloatingLabelData[]
  featureWidth: number
}

interface RenderingWithLayout {
  layout?: { getRectangles?: () => Map<string, LayoutRecord> }
}

/**
 * Extract layout maps from rendering results for floating label calculation.
 * Each rendering may have a layout with getRectangles() that returns feature positions.
 */
export function collectLayoutsFromRenderings(
  renderings: readonly (readonly [unknown, RenderingWithLayout])[],
): Map<string, LayoutRecord>[] {
  const layoutMaps: Map<string, LayoutRecord>[] = []
  for (const [, rendering] of renderings) {
    if (rendering.layout?.getRectangles) {
      layoutMaps.push(rendering.layout.getRectangles())
    }
  }
  return layoutMaps
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

    const [, topPx, , , feature] = val
    const {
      refName,
      floatingLabels,
      totalFeatureHeight,
      actualTopPx,
      featureWidth,
      featureStartBp,
      featureEndBp,
    } = feature
    const effectiveTopPx = actualTopPx ?? topPx

    if (
      !floatingLabels ||
      floatingLabels.length === 0 ||
      !totalFeatureHeight ||
      featureWidth === undefined ||
      featureStartBp === undefined ||
      featureEndBp === undefined
    ) {
      continue
    }

    // Use actual feature coordinates, not layout coordinates (which include padding)
    const positions = getFeaturePositions(
      view,
      assembly,
      refName,
      featureStartBp,
      featureEndBp,
      bpPerPx,
    )

    if (!positions) {
      continue
    }

    const existing = featureLabels.get(key)
    if (!existing || positions.leftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx: positions.leftPx,
        topPx: effectiveTopPx,
        totalFeatureHeight,
        floatingLabels,
        featureWidth,
      })
    }
  }

  return featureLabels
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
 * @returns The x position for the label (already offset-adjusted)
 */
export function calculateFloatingLabelPosition(
  featureLeftPx: number,
  featureRightPx: number,
  labelWidth: number,
  offsetPx: number,
): number {
  const featureWidth = featureRightPx - featureLeftPx

  if (labelWidth > featureWidth) {
    // Label doesn't fit within feature - don't float, use fixed position
    return featureLeftPx - offsetPx
  }

  // Label fits within feature - apply floating logic
  // Viewport left edge: when scrolled left (offsetPx < 0), starts at 0; otherwise at offsetPx
  const viewportLeft = Math.max(0, offsetPx)
  const leftPx = Math.max(featureLeftPx, viewportLeft)
  const naturalX = leftPx - offsetPx
  const maxX = featureRightPx - offsetPx - labelWidth
  return clamp(naturalX, 0, maxX)
}
