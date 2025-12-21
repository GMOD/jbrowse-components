import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FloatingLabelData, LayoutRecord } from '../model'

const fontSize = 11

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
): PixelPositions | undefined {
  const canonicalRefName = assembly?.getCanonicalRefName(refName) || refName
  const { bpPerPx } = view

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
  labelWidth: number
  y: number
  offsetPx: number
}

const FloatingLabel = observer(function ({
  text,
  color,
  isOverlay,
  featureLeftPx,
  featureRightPx,
  labelWidth,
  y,
  offsetPx,
}: LabelProps) {
  const naturalX = featureLeftPx - offsetPx
  const maxX = featureRightPx - offsetPx - labelWidth
  const x = clamp(0, naturalX, maxX)

  return (
    <div
      style={{
        position: 'absolute',
        fontSize: '11px',
        pointerEvents: 'none',
        color,
        backgroundColor: isOverlay ? 'rgba(255, 255, 255, 0.8)' : undefined,
        lineHeight: isOverlay ? '1' : undefined,
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {text}
    </div>
  )
})

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
  const { offsetPx } = view

  if (!assembly) {
    return null
  }

  const featureLabels = deduplicateFeatureLabels(layoutFeatures, view, assembly)
  const labels: React.ReactElement[] = []

  for (const [
    key,
    { leftPx, rightPx, topPx, totalFeatureHeight, floatingLabels },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureWidth = rightPx - leftPx

    for (let i = 0, l = floatingLabels.length; i < l; i++) {
      const floatingLabel = floatingLabels[i]!
      const { text, relativeY, color, isOverlay } = floatingLabel

      const labelWidth = measureText(text, fontSize)
      if (labelWidth > featureWidth) {
        continue
      }

      const y = featureVisualBottom + relativeY

      labels.push(
        <FloatingLabel
          key={`${key}-${i}`}
          text={text}
          color={color}
          isOverlay={isOverlay}
          featureLeftPx={leftPx}
          featureRightPx={rightPx}
          labelWidth={labelWidth}
          y={y}
          offsetPx={offsetPx}
        />,
      )
    }
  }

  return (
    <div
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
