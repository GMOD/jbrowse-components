import type { DisplayConfig } from '../renderConfig.ts'
import type { FeatureLayout, GlyphType, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const HEIGHT_MULTIPLIERS: Record<string, number> = {
  normal: 1,
  compact: 0.6,
  superCompact: 0.3,
  reducedRepresentation: 1,
  collapse: 1,
}

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

export function getFeatureHeightPx(_feature: Feature, config: DisplayConfig) {
  const heightMultiplier = HEIGHT_MULTIPLIERS[config.displayMode] ?? 1
  return config.featureHeight * heightMultiplier
}

// Used by main-thread label-fit math in LinearBasicDisplay/layout.ts —
// kept exported for that consumer.
export const STRAND_ARROW_WIDTH = 8

export function layoutChild(
  child: Feature,
  _parentFeature: Feature,
  args: LayoutArgs,
): FeatureLayout {
  return {
    feature: child,
    glyphType: 'Box',
    y: 0,
    height: getFeatureHeightPx(child, args.config),
    totalLayoutHeight: getFeatureHeightPx(child, args.config),
    children: [],
  }
}

// Shared layout for container glyphs (ProcessedTranscript, Segments)
// that have sorted children
export function layoutContainerGlyph(
  glyphType: GlyphType,
  args: LayoutArgs,
  subfeatures: Feature[],
): FeatureLayout {
  const heightPx = getFeatureHeightPx(args.feature, args.config)
  const children = sortByPosition(
    subfeatures.map(child => layoutChild(child, args.feature, args)),
  )
  return {
    feature: args.feature,
    glyphType,
    y: 0,
    height: heightPx,
    totalLayoutHeight: heightPx,
    children,
  }
}
