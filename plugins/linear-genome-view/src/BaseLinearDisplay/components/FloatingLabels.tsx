import { useEffect, useMemo, useRef } from 'react'

import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../model'

// Cache for text measurements to avoid re-measuring same text
const textMeasureCache = new Map<string, number>()

function getCachedMeasureText(text: string, fontSize: number): number {
  const key = `${text}:${fontSize}`
  let width = textMeasureCache.get(key)
  if (width === undefined) {
    width = measureText(text, fontSize)
    // Keep cache size reasonable (max 500 entries)
    if (textMeasureCache.size > 500) {
      const firstKey = textMeasureCache.keys().next().value
      if (firstKey) {
        textMeasureCache.delete(firstKey)
      }
    }
    textMeasureCache.set(key, width)
  }
  return width
}

interface LabelItemProps {
  label: string
  description: string
  leftPos: number
  topPos: number
}

const FloatingLabels = observer(function FloatingLabels({
  model,
}: {
  model: BaseLinearDisplayModel
}): React.ReactElement | null {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const { offsetPx } = view
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  const containerRef = useRef<HTMLDivElement>(null)
  const domElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // Memoize the processed label data to avoid recalculating positions
  const labelData = useMemo(() => {
    if (!assembly) {
      return []
    }

    const fontSize = 11
    const result: (LabelItemProps & { key: string })[] = []

    for (const [key, val] of model.layoutFeatures.entries()) {
      if (!val?.[4]) {
        continue
      }

      const [left, , right, bottom, feature] = val
      const { refName = '', description, label } = feature

      if (!label) {
        continue
      }

      const r0 = assembly.getCanonicalRefName(refName) || refName
      const r = view.bpToPx({
        refName: r0,
        coord: left,
      })?.offsetPx
      const r2 = view.bpToPx({
        refName: r0,
        coord: right,
      })?.offsetPx

      if (r === undefined) {
        continue
      }

      // Cache text measurement
      const labelWidth = getCachedMeasureText(label, fontSize)

      // Calculate clamped position
      const leftPos = clamp(
        0,
        r - offsetPx,
        r2 !== undefined
          ? r2 - offsetPx - labelWidth
          : Number.POSITIVE_INFINITY,
      )

      const topPos = bottom - 14 * (+!!label + +!!description)

      result.push({
        key,
        label,
        description: description || '',
        leftPos,
        topPos,
      })
    }

    return result
  }, [model.layoutFeatures, view, assembly, offsetPx])

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
    <div ref={containerRef} style={{ position: 'relative' }} />
  ) : null
})

export default FloatingLabels
