import { clamp } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { FloatingLabelData, LayoutRecord } from '../types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

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

export function collectLayoutsFromRenderings(
  renderings: readonly (readonly [unknown, RenderingWithLayout])[],
): Map<string, LayoutRecord>[] {
  return renderings.flatMap(([, rendering]) =>
    rendering.layout?.getRectangles ? [rendering.layout.getRectangles()] : [],
  )
}

function calculateFeatureLeftPx(
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  refName: string,
  left: number,
  right: number,
  bpPerPx: number,
): number | undefined {
  const canonicalRefName = assembly?.getCanonicalRefName2(refName) ?? refName

  const leftBpPx = view.bpToPx({
    refName: canonicalRefName,
    coord: left,
  })?.offsetPx

  const rightBpPx = view.bpToPx({
    refName: canonicalRefName,
    coord: right,
  })?.offsetPx

  if (leftBpPx !== undefined) {
    // Use Math.min to handle reversed regions where genomic left maps to visual right
    const rightEstimate = rightBpPx ?? leftBpPx + (right - left) / bpPerPx
    return Math.min(leftBpPx, rightEstimate)
  } else if (rightBpPx !== undefined) {
    const leftEstimate = rightBpPx - (right - left) / bpPerPx
    return Math.min(leftEstimate, rightBpPx)
  }
  return undefined
}

// fallback for features whose primary endpoints are both off-screen (e.g. collapsed introns)
function calculateMultiRegionLeftPx(
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  refName: string,
  left: number,
  right: number,
): number | undefined {
  const canonicalRefName = assembly?.getCanonicalRefName2(refName) ?? refName
  const visibleRegions = view.displayedRegions.filter(
    r => r.refName === canonicalRefName && r.start < right && r.end > left,
  )

  if (visibleRegions.length === 0) {
    return undefined
  }

  let minLeftPx = Infinity

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
    }
  }

  return minLeftPx === Infinity ? undefined : minLeftPx
}

function getFeatureLeftPx(
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  refName: string,
  left: number,
  right: number,
  bpPerPx: number,
): number | undefined {
  return (
    calculateFeatureLeftPx(view, assembly, refName, left, right, bpPerPx) ??
    calculateMultiRegionLeftPx(view, assembly, refName, left, right)
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
    const leftPx = getFeatureLeftPx(
      view,
      assembly,
      refName,
      featureStartBp,
      featureEndBp,
      bpPerPx,
    )

    if (leftPx === undefined) {
      continue
    }

    const floorLeftPx = Math.floor(leftPx)
    const existing = featureLabels.get(key)
    if (!existing || floorLeftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx: floorLeftPx,
        topPx: effectiveTopPx,
        totalFeatureHeight,
        floatingLabels,
        featureWidth,
      })
    }
  }

  return featureLabels
}

// label wider than feature → fixed at feature left; otherwise floats to stay visible within feature bounds
export function calculateFloatingLabelPosition(
  featureLeftPx: number,
  featureRightPx: number,
  labelWidth: number,
  offsetPx: number,
): number {
  const featureWidth = featureRightPx - featureLeftPx

  if (labelWidth > featureWidth) {
    return Math.round(featureLeftPx - offsetPx)
  }

  const viewportLeft = Math.max(0, offsetPx)
  const leftPx = Math.max(featureLeftPx, viewportLeft)
  const naturalX = leftPx - offsetPx
  const maxX = featureRightPx - offsetPx - labelWidth
  return Math.round(clamp(naturalX, 0, maxX))
}
