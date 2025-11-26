import { useEffect, useRef } from 'react'

import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { autorun } from 'mobx'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FloatingLabelData, LayoutRecord } from '../model'

function calculateLabelWidth(text: string, fontSize: number) {
  return measureText(text, fontSize)
}

function calculateClampedLabelPosition(
  layoutLeftPx: number,
  layoutRightPx: number | undefined,
  viewOffsetPx: number,
  labelWidth: number,
) {
  const minPosition = 0
  const naturalPosition = layoutLeftPx - viewOffsetPx
  const maxPosition =
    layoutRightPx !== undefined
      ? layoutRightPx - viewOffsetPx - labelWidth
      : Number.POSITIVE_INFINITY

  return clamp(minPosition, naturalPosition, maxPosition)
}

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

  // Handle partially visible features in multi-region views:
  // - If left is visible, use it; if right is in collapsed region, calculate it
  // - If left is in collapsed region but right is visible, calculate left from right
  // - If neither is visible, return undefined
  if (leftBpPx !== undefined) {
    // Left edge is visible
    const px1 = leftBpPx
    const px2 =
      rightBpPx !== undefined ? rightBpPx : px1 + (right - left) / bpPerPx

    // Normalize so leftPx is always visual left and rightPx is visual right
    // When region is reversed, genomic coords map to opposite pixel positions
    return {
      leftPx: Math.min(px1, px2),
      rightPx: Math.max(px1, px2),
    }
  } else if (rightBpPx !== undefined) {
    // Right edge is visible but left is not (feature starts in collapsed region)
    const px2 = rightBpPx
    const px1 = px2 - (right - left) / bpPerPx

    // Normalize so leftPx is always visual left and rightPx is visual right
    return {
      leftPx: Math.min(px1, px2),
      rightPx: Math.max(px1, px2),
    }
  } else {
    // Neither edge is visible
    return undefined
  }
}

interface FeatureLabelData {
  leftPx: number
  rightPx: number
  topPx: number
  totalFeatureHeight: number
  floatingLabels: FloatingLabelData[]
  totalLayoutWidth?: number
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
    const {
      refName = '',
      floatingLabels,
      totalFeatureHeight,
      totalLayoutWidth,
      actualTopPx,
    } = feature

    // Use actualTopPx if available (for subfeatures whose visual position
    // differs from their layout collision detection position)
    const effectiveTopPx = actualTopPx ?? topPx

    // Skip if no floating labels
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

    // De-duplicate: keep the left-most position for each feature
    const existing = featureLabels.get(key)
    if (!existing || leftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx,
        rightPx,
        topPx: effectiveTopPx,
        totalFeatureHeight,
        floatingLabels,
        totalLayoutWidth,
      })
    }
  }

  return featureLabels
}

function FloatingLabels({
  model,
}: {
  model: FeatureTrackModel
}): React.ReactElement {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  const containerRef = useRef<HTMLDivElement>(null)
  const domElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!assembly) {
      return
    }

    return autorun(() => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const { layoutFeatures } = model
      const { offsetPx } = view
      const fontSize = 11
      const domElements = domElementsRef.current
      const newKeys = new Set<string>()

      // First pass: de-duplicate features and get left-most positions
      const featureLabels = deduplicateFeatureLabels(
        layoutFeatures,
        view,
        assembly,
      )

      // Second pass: create label items and update DOM
      for (const [
        key,
        {
          leftPx,
          rightPx,
          topPx,
          totalFeatureHeight,
          floatingLabels,
          totalLayoutWidth,
        },
      ] of featureLabels.entries()) {
        // Calculate the bottom of the visual feature (not including label space)
        const featureVisualBottom = topPx + totalFeatureHeight

        // Process each floating label
        for (const [i, floatingLabel] of floatingLabels.entries()) {
          const { text, relativeY, color, isOverlay } = floatingLabel

          // Calculate label width for this specific text
          const labelWidth = calculateLabelWidth(text, fontSize)

          // Only show labels that fit within the layout bounds
          // Use totalLayoutWidth if available (includes label space), otherwise fall back to rect width
          const layoutWidth = totalLayoutWidth ?? rightPx - leftPx
          if (labelWidth > layoutWidth) {
            continue
          }

          // leftPx is always the feature's visual left because:
          // - When normal: layout extends right, so leftPx = feature's visual left
          // - When reversed: layout extends left in genomic coords, which after
          //   pixel conversion means leftPx = feature's visual left (featureEnd in genomic)
          const featureVisualLeftPx = leftPx

          // Calculate clamped horizontal position
          // Use totalLayoutWidth if available to determine the right edge for clamping
          const effectiveRightPx =
            totalLayoutWidth !== undefined
              ? featureVisualLeftPx + totalLayoutWidth
              : rightPx
          const x = calculateClampedLabelPosition(
            featureVisualLeftPx,
            effectiveRightPx,
            offsetPx,
            labelWidth,
          )

          // Convert relative Y to absolute Y
          const y = featureVisualBottom + relativeY

          const labelKey = `${key}-${i}`
          newKeys.add(labelKey)

          let element = domElements.get(labelKey)

          if (!element) {
            element = document.createElement('div')
            element.style.position = 'absolute'
            element.style.fontSize = '11px'
            element.style.pointerEvents = 'none'
            element.style.willChange = 'transform'
            container.append(element)
            domElements.set(labelKey, element)
          }

          if (element.textContent !== text) {
            element.textContent = text
          }
          if (element.style.color !== color) {
            element.style.color = color
          }
          // Add semi-transparent background for overlay labels to improve readability
          const bgColor = isOverlay ? 'rgba(255, 255, 255, 0.8)' : ''
          if (element.style.backgroundColor !== bgColor) {
            element.style.backgroundColor = bgColor
          }
          const lineHeight = isOverlay ? '1' : ''
          if (element.style.lineHeight !== lineHeight) {
            element.style.lineHeight = lineHeight
          }
          element.style.transform = `translate(${x}px, ${y}px)`
        }
      }

      // Remove elements that are no longer needed
      for (const [key, element] of domElements.entries()) {
        if (!newKeys.has(key)) {
          element.remove()
          domElements.delete(key)
        }
      }
    })
  }, [assembly, model, view])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

export default FloatingLabels
