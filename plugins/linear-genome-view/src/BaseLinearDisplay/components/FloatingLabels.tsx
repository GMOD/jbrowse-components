import { useEffect, useRef } from 'react'

import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { autorun, untracked } from 'mobx'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FloatingLabelData, LayoutRecord } from '../model'

const fontSize = 11
const labelWidthCache = new Map<string, number>()

function calculateLabelWidth(text: string) {
  let width = labelWidthCache.get(text)
  if (width === undefined) {
    width = measureText(text, fontSize)
    labelWidthCache.set(text, width)
  }
  return width
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
        totalLayoutWidth,
      })
    }
  }

  return featureLabels
}

// Data stored per label element for fast offset updates
interface LabelPositionData {
  featureLeftPx: number
  effectiveRightPx: number
  labelWidth: number
  y: number
  lastX?: number
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
  const labelPositionsRef = useRef<Map<string, LabelPositionData>>(new Map())

  // Autorun 1: Rebuild DOM elements when layoutFeatures changes
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
      const domElements = domElementsRef.current
      const labelPositions = labelPositionsRef.current
      const newKeys = new Set<string>()

      const featureLabels = deduplicateFeatureLabels(
        layoutFeatures,
        view,
        assembly,
      )

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
        const featureVisualBottom = topPx + totalFeatureHeight

        for (const [i, floatingLabel] of floatingLabels.entries()) {
          const { text, relativeY, color, isOverlay } = floatingLabel

          const labelWidth = calculateLabelWidth(text)
          const layoutWidth = totalLayoutWidth ?? rightPx - leftPx
          if (labelWidth > layoutWidth) {
            continue
          }

          const featureVisualLeftPx = leftPx
          const effectiveRightPx =
            totalLayoutWidth !== undefined
              ? featureVisualLeftPx + totalLayoutWidth
              : rightPx
          const y = featureVisualBottom + relativeY

          const labelKey = `${key}-${i}`
          newKeys.add(labelKey)

          // Store position data for fast offset updates
          labelPositions.set(labelKey, {
            featureLeftPx: featureVisualLeftPx,
            effectiveRightPx,
            labelWidth,
            y,
          })

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
          const bgColor = isOverlay ? 'rgba(255, 255, 255, 0.8)' : ''
          if (element.style.backgroundColor !== bgColor) {
            element.style.backgroundColor = bgColor
          }
          const lineHeight = isOverlay ? '1' : ''
          if (element.style.lineHeight !== lineHeight) {
            element.style.lineHeight = lineHeight
          }

          // Set initial transform (offset autorun will update x on scroll)
          // Use untracked to avoid this autorun re-running on offsetPx changes
          const offsetPx = untracked(() => view.offsetPx)
          const naturalX = featureVisualLeftPx - offsetPx
          const maxX = effectiveRightPx - offsetPx - labelWidth
          const x = clamp(0, naturalX, maxX)
          element.style.transform = `translate(${x}px, ${y}px)`
        }
      }

      // Remove stale elements
      for (const [key, element] of domElements.entries()) {
        if (!newKeys.has(key)) {
          element.remove()
          domElements.delete(key)
          labelPositions.delete(key)
        }
      }
    })
  }, [assembly, model, view])

  // Autorun 2: Update transforms when offsetPx changes (fast path)
  useEffect(() => {
    return autorun(() => {
      const { offsetPx } = view
      const domElements = domElementsRef.current
      const labelPositions = labelPositionsRef.current

      for (const [key, element] of domElements.entries()) {
        const pos = labelPositions.get(key)
        if (!pos) {
          continue
        }

        const { featureLeftPx, effectiveRightPx, labelWidth, y } = pos
        const naturalX = featureLeftPx - offsetPx
        const maxX = effectiveRightPx - offsetPx - labelWidth
        const x = clamp(0, naturalX, maxX)

        // Only update DOM if x position changed
        if (pos.lastX !== x) {
          pos.lastX = x
          element.style.transform = `translate(${x}px, ${y}px)`
        }
      }
    })
  }, [view])

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
