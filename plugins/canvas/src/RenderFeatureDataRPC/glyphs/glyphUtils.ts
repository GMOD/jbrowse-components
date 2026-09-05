import { LABEL_FONT_SIZE } from '../constants.ts'
import { readConfigValueSafe } from '../renderConfig.ts'
import { getSubfeatures, isCDS } from '../util.ts'

import type { DisplayMode } from '../renderConfig.ts'
import type { FeatureLayout, GlyphType, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Exported for main-thread post-processing (applyHeightScale in
// applyLayout.ts): after the worker returns geometry in normal-mode units
// (multiplier=1), the layout step scales all height/y fields by this factor so
// compact/superCompact never require a re-fetch.
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
//
// This table is ALSO the row reservation — `labelFontPx` is `labelFontSize()`,
// and both the packed row height (`bodyHeightPx + rowPadding + labelLines ×
// labelFontPx`) and the `below` subfeature-label row are spent at it. So a
// change here is a layout change, not only a typography one. That is new: the
// `below` row used to be reserved in the worker against HEIGHT_MULTIPLIERS,
// which is the mismatch that let labels overlap (see reservesBelowLabelRow).
//
// Which makes these numbers the only lever on how compact a LABELED compact
// track is, because in these modes the text is most of the row — the bodies have
// already shrunk past it. With a 10px feature and one name line:
//
//   labels off   normal 15.0   compact  8.0 (0.53x)   superCompact  4.0 (0.27x)
//   one line     normal 26.0   compact 17.4 (0.67x)   superCompact 11.7 (0.45x)
//   two lines    normal 37.0   compact 26.7 (0.72x)   superCompact 19.4 (0.52x)
//
// i.e. a labeled superCompact row is 66% label, and lands at 0.45x rather than
// the 0.3x its body multiplier suggests. 0.85/0.7 were set when this table did
// NOT drive the reservation, so shrinking the text bought nothing but smaller
// text; 0.75/0.65 now takes 6-11% off a labeled row (text 8.3px / 7.2px), which
// is the compaction available without dropping label lines outright.
export const LABEL_FONT_MULTIPLIERS: Record<DisplayMode, number> = {
  normal: 1,
  compact: 0.75,
  superCompact: 0.65,
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

// Gap between two stacked transcripts of one gene, as a fraction of the gene's
// own box height, so the entire within-gene layout scales linearly — the
// main-thread compact scale (multiplier × all y values) is then exact.
export const TRANSCRIPT_PADDING_RATIO = 0.2

// The gap the worker spent inside one gene, from the box height its stack ships.
// The trim closes a dropped isoform's hole with this, and the gap floor measures
// against it (isoformGapFloor.ts) — both re-derived from `boxHeightPx` rather
// than shipped beside it, because a gap alone cannot answer what the floor asks:
// how tall the boxes either side of it DRAW.
export function isoformGapPx(stack: { boxHeightPx: number }) {
  return stack.boxHeightPx * TRANSCRIPT_PADDING_RATIO
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
export const FALLBACK_FEATURE_HEIGHT = 10

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

// A CDS here or anywhere below: ranks coding transcripts ahead of non-coding
// ones when stacking, so they render on top.
//
// The feature ITSELF counts, because an isoform can be the CDS rather than
// contain one — a viral polyprotein (NCBI's gene → CDS → mature_protein_region)
// hangs cleavage products off its CDS, not further CDSs. Read as a subtree-only
// question, the biologically important feature on a viral genome answered
// "codes for nothing" and sorted below every ordinary mRNA in its gene.
export function isCodingFeature(feature: Feature): boolean {
  return isCDS(feature) || getSubfeatures(feature).some(isCodingFeature)
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
    children,
  }
}
