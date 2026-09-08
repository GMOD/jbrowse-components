import { LABEL_FONT_SIZE } from '../constants.ts'
import { readConfigValueSafe } from '../renderConfig.ts'
import { getSubfeatures, isCDS } from '../util.ts'

import type { DisplayMode } from '../renderConfig.ts'
import type { FeatureLayout, GlyphType, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// The worker returns geometry in normal-mode units and the main thread scales
// every height/y by this factor, so compact/superCompact never re-fetch.
export const HEIGHT_MULTIPLIERS: Record<DisplayMode, number> = {
  normal: 1,
  compact: 0.6,
  superCompact: 0.3,
  // collapsed stacks at full height; its density comes from the single row, not
  // from a shorter body.
  collapsed: 1,
}

// Gentler than HEIGHT_MULTIPLIERS, because reusing 0.6/0.3 would drop
// superCompact labels to ~3px. This table also drives the row reservation, so a
// change here is a layout change and not only a typography one.
export const LABEL_FONT_MULTIPLIERS: Record<DisplayMode, number> = {
  normal: 1,
  compact: 0.75,
  superCompact: 0.65,
  // collapsed never draws labels; the entry only keeps the Record exhaustive.
  collapsed: 1,
}

// Compact modes tighten the gap between rows more than the body shrink alone
// would.
export const ROW_PADDING: Record<DisplayMode, number> = {
  normal: 5,
  compact: 2,
  superCompact: 1,
  collapsed: 5,
}

// A fraction of the gene's own box height rather than a pixel gap, so the whole
// within-gene layout scales linearly under the main thread's compact multiplier.
export const TRANSCRIPT_PADDING_RATIO = 0.2

// Re-derived from the shipped `boxHeightPx` rather than shipped beside it: a
// gap alone cannot answer how tall the boxes either side of it draw.
export function isoformGapPx(stack: { boxHeightPx: number }) {
  return stack.boxHeightPx * TRANSCRIPT_PADDING_RATIO
}

export function labelFontSize(displayMode: DisplayMode) {
  return LABEL_FONT_SIZE * LABEL_FONT_MULTIPLIERS[displayMode]
}

// Matches the config slot's own default, so a broken `featureHeight` expression
// degrades to the standard row rather than to nothing.
export const FALLBACK_FEATURE_HEIGHT = 10

// `featureHeight` is a per-feature callback slot, so reading it as a bare number
// flows the expression STRING into a Float32Array height and the track paints
// nothing. `feature` is a parameter rather than read off `args` because the
// callers disagree about which one to resolve against — a child's own box, or
// the container row its children ride on.
export function featureHeightPx(feature: Feature, args: LayoutArgs): number {
  const { config, jexl } = args
  const raw = config.featureHeight
  if (typeof raw === 'number') {
    return raw
  }
  const value = jexl
    ? readConfigValueSafe<unknown>(
        config,
        'featureHeight',
        feature,
        jexl,
        FALLBACK_FEATURE_HEIGHT,
      )
    : undefined
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : FALLBACK_FEATURE_HEIGHT
}

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

export function hasCDSSubfeature(feature: Feature) {
  return getSubfeatures(feature).some(isCDS)
}

// Separates a feature whose children are multi-part glyphs needing their own
// rows (gene → transcripts) from one whose children are leaves sharing a single
// row (match → segments).
export function hasContainerChildren(feature: Feature) {
  return getSubfeatures(feature).some(sub => getSubfeatures(sub).length > 0)
}

// Whether the glyph paints an intron INSIDE this layout: a gap between two of
// the parts it drew, which is the same walk `emitIntronLines` makes. The
// leading and trailing connectors it also paints are excluded, being the
// feature overhanging its own parts rather than a gap between them.
export function paintsInternalIntron(layout: FeatureLayout) {
  let prevEnd = layout.feature.get('start')
  return layout.children.some(child => {
    const gap = child.feature.get('start') > prevEnd
    prevEnd = Math.max(prevEnd, child.feature.get('end'))
    return gap
  })
}

// The feature ITSELF counts, because an isoform can BE the CDS rather than
// contain one — a viral polyprotein hangs its cleavage products off its CDS,
// not off further CDSs.
export function isCodingFeature(feature: Feature): boolean {
  return isCDS(feature) || getSubfeatures(feature).some(isCodingFeature)
}

export const STRAND_ARROW_WIDTH = 8

export function layoutChild(child: Feature, args: LayoutArgs): FeatureLayout {
  // Resolved against the CHILD, not `args.feature`: this is the child's own box.
  const height = featureHeightPx(child, args)
  return {
    feature: child,
    glyphType: 'Box',
    y: 0,
    height,
    children: [],
  }
}

export function layoutContainerGlyph(
  glyphType: GlyphType,
  args: LayoutArgs,
  subfeatures: Feature[],
): FeatureLayout {
  // The children draw at THIS height rather than their own, so an exon never
  // outgrows the row its introns are drawn on.
  const heightPx = featureHeightPx(args.feature, args)
  const children = sortByPosition(
    subfeatures.map(child => layoutChild(child, args)),
  )
  return {
    feature: args.feature,
    glyphType,
    y: 0,
    height: heightPx,
    children,
  }
}
