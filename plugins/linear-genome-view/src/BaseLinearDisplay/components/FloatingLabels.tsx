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

interface LabelItemProps {
  label: string
  description: string
  leftPos: number
  topPos: number
}

function getFeaturePixelPositions(
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName: (refName: string) => string | undefined } | undefined,
  refName: string,
  left: number,
  right: number,
) {
  const canonicalRefName = assembly?.getCanonicalRefName(refName) || refName
  const leftPx = view.bpToPx({
    refName: canonicalRefName,
    coord: left,
  })?.offsetPx
  const rightPx = view.bpToPx({
    refName: canonicalRefName,
    coord: right,
  })?.offsetPx

  return { leftPx, rightPx }
}

function calculateLabelWidth(text: string, fontSize: number) {
  return measureText(text, fontSize)
}

function calculateLabelTopOffset(hasLabel: boolean, hasDescription: boolean) {
  return 14 * (+hasDescription + +hasLabel)
}

function shouldShowLabel(
  featureLeftPx: number | undefined,
  featureRightPx: number | undefined,
  viewOffsetPx: number,
  labelWidth: number,
) {
  if (featureLeftPx === undefined || featureRightPx === undefined) {
    return false
  }

  const featureWidth = featureRightPx - featureLeftPx
  if (labelWidth > featureWidth) {
    return false
  }

  // Check that label won't extend beyond feature's right edge in viewport
  const featureRightViewport = featureRightPx - viewOffsetPx
  return featureRightViewport >= labelWidth
}

function calculateClampedLabelPosition(
  featureLeftPx: number,
  featureRightPx: number | undefined,
  viewOffsetPx: number,
  labelWidth: number,
) {
  const minPosition = 0
  const naturalPosition = featureLeftPx - viewOffsetPx
  const maxPosition =
    featureRightPx !== undefined
      ? featureRightPx - viewOffsetPx - labelWidth
      : Number.POSITIVE_INFINITY

  return clamp(minPosition, naturalPosition, maxPosition)
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
      return []
    }

    const fontSize = 11
    const result: (LabelItemProps & { key: string })[] = []
    for (const [key, val] of layoutFeatures.entries()) {
      if (!val?.[4]) {
        continue
      }

      const [left, , right, bottom, feature] = val
      const { refName = '', description = '', label = '' } = feature

      // Determine what to display based on config settings
      const displayLabel = showLabels && label ? label : ''
      const displayDescription =
        showDescriptions && description ? description : ''

      // Skip if both display label and description are empty
      if (!displayLabel && !displayDescription) {
        continue
      }

      // Get feature pixel positions
      const { leftPx, rightPx } = getFeaturePixelPositions(
        view,
        assembly,
        refName,
        left,
        right,
      )

      // Calculate label dimensions
      const labelWidth = calculateLabelWidth(
        displayLabel || displayDescription,
        fontSize,
      )

      // Only show labels that fit within the feature bounds (no floating)
      if (!shouldShowLabel(leftPx, rightPx, offsetPx, labelWidth)) {
        continue
      }

      // Calculate clamped horizontal position
      const leftPos = calculateClampedLabelPosition(
        leftPx!,
        rightPx,
        offsetPx,
        labelWidth,
      )

      // Calculate vertical position
      const topPos =
        bottom - calculateLabelTopOffset(!!displayLabel, !!displayDescription)

      result.push({
        key,
        label: displayLabel,
        description: displayDescription,
        leftPos,
        topPos,
      })
    }

    return result
  }, [layoutFeatures, view, assembly, offsetPx, showLabels, showDescriptions])

  // Manually manipulate DOM for better performance
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const domElements = domElementsRef.current
    const newKeys = new Set<string>()

    // Create or update elements
    for (const { key, label, description, leftPos, topPos } of labelData) {
      newKeys.add(key)

      let element = domElements.get(key)

      if (!element) {
        // Create new element
        element = document.createElement('div')
        element.style.position = 'absolute'
        element.style.fontSize = '11px'
        element.style.pointerEvents = 'none'
        element.style.willChange = 'transform'

        const labelDiv = document.createElement('div')
        const descDiv = document.createElement('div')
        descDiv.style.color = 'blue'

        element.append(labelDiv)
        element.append(descDiv)

        container.append(element)
        domElements.set(key, element)
      }

      // Update element content and position
      const labelDiv = element.children[0] as HTMLDivElement
      const descDiv = element.children[1] as HTMLDivElement

      if (labelDiv.textContent !== label) {
        labelDiv.textContent = label
      }
      if (descDiv.textContent !== description) {
        descDiv.textContent = description
      }

      element.style.transform = `translate(${leftPos}px, ${topPos}px)`
    }

    // Remove elements that are no longer needed
    for (const [key, element] of domElements.entries()) {
      if (!newKeys.has(key)) {
        // Check if element is actually a child before removing
        if (element.parentNode === container) {
          element.remove()
        }
        domElements.delete(key)
      }
    }

    // Cleanup function to remove all elements on unmount
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
