import { useMemo } from 'react'

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
      const firstKey = textMeasureCache.keys().next().value as string | undefined
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

// Memoized label item component
const LabelItem = ({ label, description, leftPos, topPos }: LabelItemProps) => (
  <div
    style={{
      position: 'absolute',
      fontSize: 11,
      pointerEvents: 'none',
      // Use transform for better performance (GPU accelerated)
      transform: `translate(${leftPos}px, ${topPos}px)`,
      willChange: 'transform',
    }}
  >
    <div>{label}</div>
    <div style={{ color: 'blue' }}>{description}</div>
  </div>
)

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
      const { refName = '', description, label } = feature || {}

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

  return labelData.length > 0 ? (
    <div style={{ position: 'relative' }}>
      {labelData.map(({ key, ...itemProps }) => (
        <LabelItem key={key} {...itemProps} />
      ))}
    </div>
  ) : null
})

export default FloatingLabels
