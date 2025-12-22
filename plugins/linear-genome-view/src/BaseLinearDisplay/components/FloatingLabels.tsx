import { useMemo } from 'react'

import { clamp, getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FloatingLabelData, LayoutRecord } from '../model'

interface PixelPositions {
  leftPx: number
  rightPx: number
}

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

  if (leftBpPx !== undefined) {
    const px1 = leftBpPx
    const px2 =
      rightBpPx !== undefined ? rightBpPx : px1 + (right - left) / bpPerPx

    return {
      leftPx: Math.min(px1, px2),
      rightPx: Math.max(px1, px2),
    }
  } else if (rightBpPx !== undefined) {
    const px2 = rightBpPx
    const px1 = px2 - (right - left) / bpPerPx

    return {
      leftPx: Math.min(px1, px2),
      rightPx: Math.max(px1, px2),
    }
  } else {
    return undefined
  }
}

interface FeatureLabelData {
  leftPx: number
  rightPx: number
  topPx: number
  totalFeatureHeight: number
  floatingLabels: FloatingLabelData[]
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
    const { refName, floatingLabels, totalFeatureHeight, actualTopPx } = feature

    const effectiveTopPx = actualTopPx ?? topPx

    if (!floatingLabels || floatingLabels.length === 0 || !totalFeatureHeight) {
      continue
    }

    const positions = calculateFeaturePixelPositions(
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

    const existing = featureLabels.get(key)
    if (!existing || leftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx,
        rightPx,
        topPx: effectiveTopPx,
        totalFeatureHeight,
        floatingLabels,
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
  tooltip,
}: LabelProps) {
  const naturalX = featureLeftPx - offsetPx
  const maxX = featureRightPx - offsetPx - labelWidth
  const x = clamp(0, naturalX, maxX)

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

const FloatingLabels = observer(function ({
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

  for (const [
    key,
    { leftPx, rightPx, topPx, totalFeatureHeight, floatingLabels },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureWidth = rightPx - leftPx

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

      if (labelWidth > featureWidth) {
        continue
      }

      const y = featureVisualBottom + relativeY

      labels.push(
        <FloatingLabel
          key={`${key}-${i}`}
          text={text}
          color={color}
          isOverlay={isOverlay ?? false}
          featureLeftPx={leftPx}
          featureRightPx={rightPx}
          featureId={key}
          labelWidth={labelWidth}
          y={y}
          offsetPx={offsetPx}
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
