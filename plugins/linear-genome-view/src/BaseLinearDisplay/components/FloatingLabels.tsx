import { useMemo } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { calculateFloatingLabelPosition } from './util'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FloatingLabelData, LayoutRecord } from '../types'

interface PixelPositions {
  leftPx: number
  rightPx: number
}

/**
 * Calculate pixel positions for a feature given its BP coordinates.
 * Handles cases where one or both ends might be off-screen by estimating
 * positions based on feature width and bpPerPx.
 */
function calculateFeaturePixelPositions(
  view: LinearGenomeViewModel,
  assembly:
    | { getCanonicalRefName: (refName: string) => string | undefined }
    | undefined,
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

  // Helper to create normalized positions from two pixel values
  const makePositions = (px1: number, px2: number): PixelPositions => ({
    leftPx: Math.min(px1, px2),
    rightPx: Math.max(px1, px2),
  })

  if (leftBpPx !== undefined) {
    // Left end is visible - use it and estimate/calculate right end
    const rightEstimate =
      rightBpPx !== undefined ? rightBpPx : leftBpPx + (right - left) / bpPerPx
    return makePositions(leftBpPx, rightEstimate)
  } else if (rightBpPx !== undefined) {
    // Right end is visible - estimate left end from right
    const leftEstimate = rightBpPx - (right - left) / bpPerPx
    return makePositions(leftEstimate, rightBpPx)
  } else {
    // Both ends are off-screen - can't determine position
    // (Will fall back to multi-region calculation)
    return undefined
  }
}

interface FeatureLabelData {
  leftPx: number
  rightPx: number
  topPx: number
  totalFeatureHeight: number
  floatingLabels: FloatingLabelData[]
  featureWidth: number
  leftPadding: number
}

/**
 * Calculate pixel positions for features that span multiple regions
 * (e.g., genes with collapsed introns where both ends are off-screen)
 */
function calculateMultiRegionPositions(
  view: LinearGenomeViewModel,
  assembly:
    | { getCanonicalRefName: (refName: string) => string | undefined }
    | undefined,
  refName: string,
  left: number,
  right: number,
): { leftPx: number; rightPx: number } | undefined {
  const canonicalRefName = assembly?.getCanonicalRefName(refName) || refName
  const visibleRegions = view.displayedRegions.filter(
    r => r.refName === canonicalRefName && r.start < right && r.end > left,
  )

  if (visibleRegions.length === 0) {
    return undefined
  }

  // Calculate the leftmost and rightmost pixel positions across ALL visible regions
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

/**
 * Try to get pixel positions for a feature, falling back to multi-region
 * calculation if both ends are off-screen.
 */
function getFeaturePositions(
  view: LinearGenomeViewModel,
  assembly:
    | { getCanonicalRefName: (refName: string) => string | undefined }
    | undefined,
  refName: string,
  left: number,
  right: number,
  bpPerPx: number,
): PixelPositions | undefined {
  // Try standard calculation first
  const positions = calculateFeaturePixelPositions(
    view,
    assembly,
    refName,
    left,
    right,
    bpPerPx,
  )

  if (positions) {
    return positions
  }

  // Fall back to multi-region calculation (for collapsed introns, etc.)
  return calculateMultiRegionPositions(view, assembly, refName, left, right)
}

function deduplicateFeatureLabels(
  layoutFeatures: {
    entries(): IterableIterator<readonly [string, LayoutRecord | undefined]>
  },
  view: LinearGenomeViewModel,
  assembly:
    | { getCanonicalRefName: (refName: string) => string | undefined }
    | undefined,
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
      leftPadding,
    } = feature
    const effectiveTopPx = actualTopPx ?? topPx

    if (
      !floatingLabels ||
      floatingLabels.length === 0 ||
      !totalFeatureHeight ||
      featureWidth === undefined ||
      leftPadding === undefined
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

    const { leftPx, rightPx } = positions

    // Store the leftmost occurrence of this feature
    const existing = featureLabels.get(key)
    if (!existing || leftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx,
        rightPx,
        topPx: effectiveTopPx,
        totalFeatureHeight,
        floatingLabels,
        featureWidth,
        leftPadding,
      })
    }
  }

  return featureLabels
}

interface LabelProps {
  text: string
  color: string
  isOverlay: boolean
  featureLeftPx: number
  featureRightPx: number
  featureId: string
  labelWidth: number
  y: number
  offsetPx: number
  viewportLeft: number
  tooltip?: string
}

function FloatingLabel({
  text,
  color,
  isOverlay,
  featureLeftPx,
  featureRightPx,
  featureId,
  labelWidth,
  y,
  offsetPx,
  viewportLeft,
  tooltip,
}: LabelProps) {
  const x = calculateFloatingLabelPosition(
    featureLeftPx,
    featureRightPx,
    labelWidth,
    offsetPx,
    viewportLeft,
  )

  return (
    <div
      data-testid={`floatingLabel-${text}`}
      data-feature-id={featureId}
      data-tooltip={tooltip}
      style={{
        position: 'absolute',
        fontSize: '11px',
        cursor: 'default',
        pointerEvents: 'auto',
        color,
        backgroundColor: isOverlay ? 'rgba(255, 255, 255, 0.8)' : undefined,
        lineHeight: isOverlay ? '1' : undefined,
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {text}
    </div>
  )
}

const FloatingLabels = observer(function FloatingLabels({
  model,
}: {
  model: FeatureTrackModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const { layoutFeatures } = model
  const { offsetPx, bpPerPx } = view
  const featureLabels = useMemo(
    () =>
      assembly
        ? deduplicateFeatureLabels(layoutFeatures, view, assembly, bpPerPx)
        : undefined,
    [layoutFeatures, view, assembly, bpPerPx],
  )

  // @ts-expect-error
  const { onFeatureClick, onFeatureContextMenu, onMouseMove } =
    model.renderingProps()

  if (!featureLabels) {
    return null
  }

  const labels: React.ReactElement[] = []

  // Optimize: Calculate viewport left edge once per render instead of per label
  const viewportLeft = Math.max(0, offsetPx)

  for (const [
    key,
    {
      leftPx,
      topPx,
      totalFeatureHeight,
      floatingLabels,
      featureWidth,
      leftPadding,
    },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureLeftPx = leftPx + leftPadding
    const featureRightPx = featureLeftPx + featureWidth

    for (let i = 0, l = floatingLabels.length; i < l; i++) {
      const floatingLabel = floatingLabels[i]!
      const {
        text,
        relativeY,
        color,
        isOverlay,
        textWidth: labelWidth,
        tooltip,
      } = floatingLabel

      const y = featureVisualBottom + relativeY

      labels.push(
        <FloatingLabel
          key={`${key}-${i}`}
          text={text}
          color={color}
          isOverlay={isOverlay ?? false}
          featureLeftPx={featureLeftPx}
          featureRightPx={featureRightPx}
          featureId={key}
          labelWidth={labelWidth}
          y={y}
          offsetPx={offsetPx}
          viewportLeft={viewportLeft}
          tooltip={tooltip}
        />,
      )
    }
  }

  return (
    <div
      onClick={e => {
        const target = e.target as HTMLElement
        const featureId = target.dataset.featureId
        if (featureId) {
          onFeatureClick?.(e, featureId)
        }
      }}
      onContextMenu={e => {
        const target = e.target as HTMLElement
        const featureId = target.dataset.featureId
        if (featureId) {
          onFeatureContextMenu?.(e, featureId)
        }
      }}
      onMouseOver={e => {
        const target = e.target as HTMLElement
        const { featureId, tooltip } = target.dataset
        if (featureId) {
          onMouseMove?.(e, featureId, tooltip)
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {labels}
    </div>
  )
})

export default FloatingLabels
