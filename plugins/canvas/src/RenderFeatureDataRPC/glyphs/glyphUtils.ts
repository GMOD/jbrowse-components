import { readCachedConfig } from '../renderConfig.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export const STRAND_ARROW_WIDTH = 8

export function getStrandArrowPadding(strand: number) {
  return {
    left: strand === -1 ? STRAND_ARROW_WIDTH : 0,
    right: strand === 1 ? STRAND_ARROW_WIDTH : 0,
    visualSide: strand === -1 ? 'left' : strand === 1 ? 'right' : null,
    width: strand ? STRAND_ARROW_WIDTH : 0,
  }
}

export function layoutChild(
  child: Feature,
  parentFeature: Feature,
  args: LayoutArgs,
  glyphType = 'Box',
): FeatureLayout {
  const { bpPerPx, configContext } = args
  const { config, featureHeight, heightMultiplier } = configContext

  const heightPx = readCachedConfig(featureHeight, config, 'height', child)
  const baseHeightPx = heightPx * heightMultiplier

  const childStart = child.get('start')
  const childEnd = child.get('end')
  const parentStart = parentFeature.get('start')

  const widthPx = (childEnd - childStart) / bpPerPx

  const offsetBp = childStart - parentStart
  const xRelativePx = offsetBp / bpPerPx

  return {
    feature: child,
    glyphType: glyphType as FeatureLayout['glyphType'],
    x: xRelativePx,
    y: 0,
    width: widthPx,
    height: baseHeightPx,
    totalLayoutHeight: baseHeightPx,
    totalLayoutWidth: widthPx,
    leftPadding: 0,
    children: [],
  }
}
