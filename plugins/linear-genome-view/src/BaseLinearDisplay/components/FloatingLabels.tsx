import { useEffect, useMemo, useRef } from 'react'

import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'

interface LabelItem {
  key: string
  text: string
  x: number
  y: number
  color: string
}

function calculateLabelWidth(text: string, fontSize: number) {
  return measureText(text, fontSize)
}

function shouldShowLabel(
  layoutLeftPx: number | undefined,
  layoutRightPx: number | undefined,
  labelWidth: number,
) {
  if (layoutLeftPx === undefined || layoutRightPx === undefined) {
    return false
  }

  const layoutWidth = layoutRightPx - layoutLeftPx
  return labelWidth <= layoutWidth
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
  assembly: { getCanonicalRefName: (refName: string) => string | undefined } | undefined,
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
    const leftPx = leftBpPx
    const rightPx = rightBpPx !== undefined ? rightBpPx : leftPx + (right - left) / bpPerPx
    return { leftPx, rightPx }
  } else if (rightBpPx !== undefined) {
    // Right edge is visible but left is not (feature starts in collapsed region)
    const rightPx = rightBpPx
    const leftPx = rightPx - (right - left) / bpPerPx
    return { leftPx, rightPx }
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
  floatingLabels: Array<{ text: string; relativeY: number; color: string }>
}

function deduplicateFeatureLabels(
  layoutFeatures: Map<string, [number, number, number, number] | [number, number, number, number, {
    label?: string
    description?: string
    refName: string
    floatingLabels?: Array<{ text: string; relativeY: number; color: string }>
    totalFeatureHeight?: number
  }]>,
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName: (refName: string) => string | undefined } | undefined,
): Map<string, FeatureLabelData> {
  const featureLabels = new Map<string, FeatureLabelData>()

  console.log('FloatingLabels: Processing', layoutFeatures.size, 'layout features')

  for (const [key, val] of layoutFeatures.entries()) {
    if (!val?.[4]) {
      continue
    }

    const [left, topPx, right, , feature] = val
    const { refName = '', floatingLabels, totalFeatureHeight } = feature

    // Skip if no floating labels
    if (!floatingLabels || floatingLabels.length === 0 || !totalFeatureHeight) {
      continue
    }

    console.log('FloatingLabels: Feature', key, {
      refName,
      left,
      right,
      topPx,
      totalFeatureHeight,
      floatingLabels,
    })

    const positions = calculateFeaturePixelPositions(
      view,
      assembly,
      refName,
      left,
      right,
    )

    if (!positions) {
      console.log('FloatingLabels: Feature not visible', key)
      continue
    }

    const { leftPx, rightPx } = positions

    console.log('FloatingLabels: Pixel positions for', key, {
      leftPx,
      rightPx,
      bpPerPx: view.bpPerPx,
      bpWidth: right - left,
    })

    // De-duplicate: keep the left-most position for each feature
    const existing = featureLabels.get(key)
    if (!existing || leftPx < existing.leftPx) {
      featureLabels.set(key, {
        leftPx,
        rightPx,
        topPx,
        totalFeatureHeight,
        floatingLabels,
      })
    }
  }

  return featureLabels
}

const FloatingLabels = observer(function FloatingLabels({
  model,
}: {
  model: FeatureTrackModel
}): React.ReactElement | null {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const { offsetPx } = view
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  const containerRef = useRef<HTMLDivElement>(null)
  const domElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const { layoutFeatures, showLabels, showDescriptions } = model

  // Memoize the processed label data to avoid recalculating positions
  const labelData = useMemo(() => {
    if (!assembly) {
      console.log('FloatingLabels: No assembly')
      return []
    }

    const fontSize = 11
    const result: LabelItem[] = []

    // First pass: de-duplicate features and get left-most positions
    const featureLabels = deduplicateFeatureLabels(layoutFeatures, view, assembly)

    // Second pass: create label items from de-duplicated features
    for (const [key, { leftPx, rightPx, topPx, totalFeatureHeight, floatingLabels }] of featureLabels.entries()) {
      // Calculate the bottom of the visual feature (not including label space)
      const featureVisualBottom = topPx + totalFeatureHeight

      // Process each floating label
      for (let i = 0; i < floatingLabels.length; i++) {
        const labelItem = floatingLabels[i]!
        const { text, relativeY, color } = labelItem

        // Calculate label width for this specific text
        const labelWidth = calculateLabelWidth(text, fontSize)

        // Only show labels that fit within the layout bounds
        if (!shouldShowLabel(leftPx, rightPx, labelWidth)) {
          console.log('FloatingLabels: Label does not fit', key, {
            text,
            labelWidth,
            leftPx,
            rightPx,
            layoutWidth: rightPx - leftPx,
          })
          continue
        }

        // Calculate clamped horizontal position
        const x = calculateClampedLabelPosition(
          leftPx,
          rightPx,
          offsetPx,
          labelWidth,
        )

        // Convert relative Y to absolute Y
        const y = featureVisualBottom + relativeY

        console.log('FloatingLabels: Adding label', key, {
          text,
          x,
          y,
          color,
        })

        result.push({
          key: `${key}-${i}`,
          text,
          x,
          y,
          color,
        })
      }
    }

    console.log('FloatingLabels: Final result count:', result.length)

    return result
  }, [layoutFeatures, view, assembly, offsetPx, showLabels, showDescriptions])

  // Render labels with minimal DOM manipulation
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const domElements = domElementsRef.current
    const newKeys = new Set<string>()

    for (const { key, text, x, y, color } of labelData) {
      newKeys.add(key)
      let element = domElements.get(key)

      if (!element) {
        element = document.createElement('div')
        element.style.position = 'absolute'
        element.style.fontSize = '11px'
        element.style.pointerEvents = 'none'
        element.style.willChange = 'transform'
        container.append(element)
        domElements.set(key, element)
      }

      if (element.textContent !== text) {
        element.textContent = text
      }
      if (element.style.color !== color) {
        element.style.color = color
      }
      element.style.transform = `translate(${x}px, ${y}px)`
    }

    // Remove elements that are no longer needed
    for (const [key, element] of domElements.entries()) {
      if (!newKeys.has(key)) {
        if (element.parentNode === container) {
          element.remove()
        }
        domElements.delete(key)
      }
    }

    return () => {
      for (const [key, element] of domElements.entries()) {
        if (element.parentNode === container) {
          element.remove()
        }
        domElements.delete(key)
      }
    }
  }, [labelData])

  return labelData.length > 0 ? (
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
  ) : null
})

export default FloatingLabels
