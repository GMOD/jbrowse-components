import { LABEL_FONT_SIZE } from '../constants.ts'
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
  // collapsed draws every feature at full height but on a single row — the
  // density comes from stacking, not from shrinking the body.
  collapsed: 1,
}

// Compact modes shrink label text alongside the feature body so the labels
// don't dwarf the tighter rows. Deliberately gentler than HEIGHT_MULTIPLIERS:
// reusing 0.6/0.3 would drop superCompact labels to ~3px and make them
// illegible, so labels shrink only enough to track the denser layout.
export const LABEL_FONT_MULTIPLIERS: Record<DisplayMode, number> = {
  normal: 1,
  compact: 0.85,
  superCompact: 0.7,
  // collapsed never draws labels, so the value is unused; keep it defined so the
  // Record stays exhaustive over DisplayMode.
  collapsed: 1,
}

// Vertical gap reserved between stacked feature rows (before any label lines).
// Compact modes tighten it more than the body shrink alone (HEIGHT_MULTIPLIERS
// would give 3px/1.5px) so dense views pack rows a little closer.
export const ROW_PADDING: Record<DisplayMode, number> = {
  normal: 5,
  compact: 2,
  superCompact: 1,
  // collapsed is a single row; this is just the trailing gap under it.
  collapsed: 5,
}

// Resolved label font size (px) for a display mode. Single source used by the
// main-thread row reservation (layout.ts), label positioning, and the DOM/SVG
// renderers so the reserved height, the name→description gap, and the drawn
// text all agree.
export function labelFontSize(displayMode: DisplayMode) {
  return LABEL_FONT_SIZE * LABEL_FONT_MULTIPLIERS[displayMode]
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
