import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { BaseLinearDisplayModel } from '../model.ts'
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

  const result: LabelData[] = []

  for (const [key, val] of model.layoutFeatures.entries()) {
    if (!val?.[4]) {
      continue
    }

    const [left, , right, bottom, feature] = val
    const { refName, description, label } = feature

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

    // Calculate positions relative to viewport
    const leftPos = leftPx - offsetPx
    const rightPos = rightPx - offsetPx

    // Skip labels for features entirely off-screen to the left
    if (rightPos <= 0) {
      continue
    }

    // Labels float to position 0 when feature extends off the left edge
    const finalLeftPos = Math.max(0, leftPos)
    const topPos = bottom - 14 * (+!!description + +!!label)

    result.push({
      key,
      label,
      description: description || '',
      leftPos: finalLeftPos,
      topPos,
    })
  }

  return result
}
