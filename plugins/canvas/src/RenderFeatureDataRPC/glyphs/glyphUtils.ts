import type { DisplayConfig } from '../renderConfig.ts'
import type { FeatureLayout, GlyphType, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Sort children left-to-right; ties broken by longest first
export function sortByPosition(children: FeatureLayout[]) {
  return [...children].sort((a, b) => {
    const aStart = a.feature.get('start')
    const bStart = b.feature.get('start')
    if (aStart !== bStart) {
      return aStart - bStart
    }
    return b.feature.get('end') - a.feature.get('end')
  })
}

export function getFeatureDimensions(
  feature: Feature,
  bpPerPx: number,
  config: DisplayConfig,
) {
  const start = feature.get('start')
  const end = feature.get('end')
  const heightMultiplier = config.displayMode === 'compact' ? 0.6 : 1
  const heightPx = (config.featureHeight as number) * heightMultiplier
  const widthPx = (end - start) / bpPerPx
  return { start, end, heightPx, widthPx }
}

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
): FeatureLayout {
  const { bpPerPx, config } = args
  const { start, heightPx, widthPx } = getFeatureDimensions(
    child,
    bpPerPx,
    config,
  )
  const parentStart = parentFeature.get('start')

  return {
    feature: child,
    glyphType: 'Box',
    x: (start - parentStart) / bpPerPx,
    y: 0,
    width: widthPx,
    height: heightPx,
    totalLayoutHeight: heightPx,
    totalLayoutWidth: widthPx,
    leftPadding: 0,
    children: [],
  }
}

// Shared layout for container glyphs (ProcessedTranscript, Segments)
// that have strand arrows and sorted children
export function layoutContainerGlyph(
  glyphType: GlyphType,
  args: LayoutArgs,
  subfeatures: Feature[],
): FeatureLayout {
  const { feature, bpPerPx, config } = args
  const { heightPx, widthPx } = getFeatureDimensions(feature, bpPerPx, config)

  const strand = feature.get('strand') as number
  const arrowPadding = getStrandArrowPadding(strand)

  const children = sortByPosition(
    subfeatures.map(child => layoutChild(child, feature, args)),
  )

  return {
    feature,
    glyphType,
    x: 0,
    y: 0,
    width: widthPx,
    height: heightPx,
    totalLayoutHeight: heightPx,
    totalLayoutWidth: widthPx + arrowPadding.left + arrowPadding.right,
    leftPadding: arrowPadding.left,
    children,
  }
}
