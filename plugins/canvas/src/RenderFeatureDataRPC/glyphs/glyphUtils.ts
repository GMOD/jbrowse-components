import { getSubfeatures, isCDS } from '../util.ts'

import type { DisplayMode } from '../renderConfig.ts'
import type { FeatureLayout, GlyphType, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Exported for main-thread post-processing in layout.ts: after the worker
// returns geometry in normal-mode units (multiplier=1), the layout step scales
// all height/y fields by this factor so compact/superCompact never require a
// re-fetch.
export const HEIGHT_MULTIPLIERS: Record<DisplayMode, number> = {
  normal: 1,
  compact: 0.6,
  superCompact: 0.3,
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

// Direct CDS child: picks the ProcessedTranscript layout (CDS + implied UTRs)
export function hasCDSSubfeature(feature: Feature) {
  return getSubfeatures(feature).some(isCDS)
}

// Direct child that is itself a container (has its own subfeatures). This is
// what distinguishes a feature whose children are multi-part glyphs needing
// their own rows (gene → transcripts) from one whose children are leaves that
// share a single row (match → segments).
export function hasContainerChildren(feature: Feature) {
  return getSubfeatures(feature).some(sub => getSubfeatures(sub).length > 0)
}

// CDS anywhere in the subtree: ranks coding transcripts ahead of non-coding
// ones when stacking, so they render on top
export function hasCodingSubfeature(feature: Feature): boolean {
  return getSubfeatures(feature).some(
    sub => isCDS(sub) || hasCodingSubfeature(sub),
  )
}

// Used by main-thread label-fit math in LinearBasicDisplay/layout.ts —
// kept exported for that consumer.
export const STRAND_ARROW_WIDTH = 8

export function layoutChild(child: Feature, args: LayoutArgs): FeatureLayout {
  const height = args.config.featureHeight
  return {
    feature: child,
    glyphType: 'Box',
    y: 0,
    height,
    totalLayoutHeight: height,
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
  const heightPx = args.config.featureHeight
  const children = sortByPosition(
    subfeatures.map(child => layoutChild(child, args)),
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
