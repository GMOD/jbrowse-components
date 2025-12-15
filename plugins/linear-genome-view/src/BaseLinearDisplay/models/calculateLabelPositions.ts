import { clamp, measureText } from '@jbrowse/core/util'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../model'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

export interface RenderProps {
  rendererType: any
  renderArgs: Record<string, any>
  renderProps: Record<string, any>
  displayError: unknown
  rpcManager: { call: (...args: unknown[]) => void }
  cannotBeRenderedReason: string
}
export interface LabelData {
  key: string
  label: string
  description: string
  leftPos: number
  topPos: number
}

export interface ErrorProps {
  displayError: string
}
/**
 * Calculate positions for floating feature labels
 * Labels are "floating" in that they clamp to the left edge of the viewport
 * when the feature scrolls off-screen to the left
 */
export function calculateLabelPositions(
  model: BaseLinearDisplayModel,
  view: LinearGenomeViewModel,
  assembly: Assembly | undefined,
  offsetPx: number,
): LabelData[] {
  if (!assembly) {
    return []
  }

  const fontSize = 11
  const result: LabelData[] = []

  for (const [key, val] of model.layoutFeatures.entries()) {
    if (!val?.[4]) {
      continue
    }

    const [left, , right, bottom, feature] = val
    const { refName = '', description, label, totalLayoutWidth } = feature

    if (!label) {
      continue
    }

    const r0 = assembly.getCanonicalRefName2(refName)
    const px1 = view.bpToPx({
      refName: r0,
      coord: left,
    })?.offsetPx
    const px2 = view.bpToPx({
      refName: r0,
      coord: right,
    })?.offsetPx

    if (px1 === undefined) {
      continue
    }

    // Normalize pixel positions: leftPx is always visual left, rightPx is visual right
    // When region is reversed, genomic left maps to visual right (px1 > px2)
    const leftPx = px2 !== undefined ? Math.min(px1, px2) : px1
    const rightPx = px2 !== undefined ? Math.max(px1, px2) : px1

    // Cache text measurement
    const labelWidth = getCachedMeasureText(label, fontSize)

    // Calculate clamped position - this is the "floating" behavior
    // Labels stick to the left edge (0) when features scroll off-screen
    // Use totalLayoutWidth if available to determine the effective right edge
    const effectiveRightPx =
      totalLayoutWidth !== undefined ? leftPx + totalLayoutWidth : rightPx
    const leftPos = clamp(
      0,
      leftPx - offsetPx,
      effectiveRightPx - offsetPx - labelWidth,
    )

    const topPos = bottom - 14 * (+!!description + +!!label)

    result.push({
      key,
      label,
      description: description || '',
      leftPos,
      topPos,
    })
  }

  return result
}

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
