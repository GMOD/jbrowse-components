import {
  clamp,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from 'mobx-state-tree'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { BaseLinearDisplayModel } from '../model'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

export interface RenderProps {
  rendererType: any
  renderArgs: Record<string, any>
  renderProps: Record<string, any>
  displayError: unknown
  rpcManager: { call: (...args: unknown[]) => void }
  cannotBeRenderedReason: string
}

export interface ErrorProps {
  displayError: string
}

export function getDisplayStr(totalBytes: number) {
  if (Math.floor(totalBytes / 1000000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    return `${Math.floor(totalBytes)} bytes`
  }
}

// stabilize clipid under test for snapshot
export function getId(id: string, index: string | number) {
  const notJest = typeof jest === 'undefined'
  return ['clip', notJest ? id : 'jest', index, notJest ? Math.random() : '']
    .filter(f => !!f)
    .join('-')
}

export async function getFeatureDensityStatsPre(
  self: IAnyStateTreeNode & {
    adapterConfig?: AnyConfigurationModel
    setMessage: (arg: string) => void
  },
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const regions = view.staticBlocks.contentBlocks

  const { rpcManager } = getSession(self)
  const { adapterConfig } = self
  if (!adapterConfig) {
    // A track extending the base track might not have an adapter config
    // e.g. Apollo tracks don't use adapters
    return {}
  }
  const sessionId = getRpcSessionId(self)

  return rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
    sessionId,
    regions,
    adapterConfig,
    statusCallback: (message: string) => {
      if (isAlive(self)) {
        self.setMessage(message)
      }
    },
  }) as Promise<FeatureDensityStats>
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

export interface LabelData {
  key: string
  label: string
  description: string
  leftPos: number
  topPos: number
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
