import { LABEL_FONT_SIZE } from '../constants.ts'
import { readConfigValueSafe } from '../renderConfig.ts'
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

// Fallback when `featureHeight` resolves to something that isn't a drawable
// number. Matches the config slot's own default, so a broken expression degrades
// to the standard row rather than to nothing.
const FALLBACK_FEATURE_HEIGHT = 10

// The body height (px) one feature is laid out at.
//
// `featureHeight` is a per-feature callback slot (`contextVariable: ['feature']`,
// like `color`/`utrColor`/`mouseover`), so it can hold a `jexl:` expression —
// but layout used to read `config.featureHeight` as a bare number. A jexl slot
// then flowed the raw expression STRING into every height: `rectHeights` is a
// Float32Array, so each box came out NaN and the track painted nothing, while
// `flatbushItems[].bottomPx` carried the expression text into the row packer.
// Failing to draw is the one outcome a per-feature height must not have, and the
// slot advertises the capability in the config editor, so resolve it here.
//
// `feature` is passed alongside `args` rather than read off it because the
// callers disagree about which one to resolve against — a child's own box vs.
// the container row its children ride on — and that choice is the whole point of
// the parameter. Everything else (the config, the jexl) comes from `args`, so no
// caller can pair a feature with the wrong config.
//
// The `typeof raw === 'number'` fast path is what keeps this free: it is the
// shape of every default config and of every config that isn't using the
// callback, so the jexl reader is reached only by the configs that asked for it.
// The result is re-checked for finiteness because an expression is free to
// return a string, a null, or a divide-by-zero.
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
  // resolved against the CHILD, not `args.feature`: this is the child's own box
  const height = featureHeightPx(child, args)
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
  // the container's own row (a transcript). Its children draw at THIS height in
  // the transcript path — emitExonRects passes `transcript.height`, not the
  // child's — so an exon never outgrows the row its introns are drawn on.
  const heightPx = featureHeightPx(args.feature, args)
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
