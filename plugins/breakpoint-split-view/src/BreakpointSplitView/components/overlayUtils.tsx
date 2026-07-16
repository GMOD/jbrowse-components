import { useEffect, useState } from 'react'

import {
  assembleLocString,
  getSession,
  truncateMiddle,
} from '@jbrowse/core/util'
import { pxToBp } from '@jbrowse/core/util/Base1DUtils'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import BreakpointTooltip from './BreakpointTooltip.tsx'
import { isOffscreenLayout } from '../util.ts'

import type { BreakpointViewModel } from '../model.ts'
import type { LayoutRecord, OverlayLevel, OverlayMatch } from '../types.ts'
import type { OverlayTrack } from '../util.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

export const LEFT = 0
export const RIGHT = 2

type MinimizableTrack = Pick<OverlayTrack, 'minimized'>

export interface OverlayProps {
  model: BreakpointViewModel
  trackId: string
  /** SVG export: fixed track tops, scrollTops zeroed */
  yOffsetsOverride?: number[]
  /** Live rendering: DOM-measured track tops relative to the overlay SVG */
  domYOffsets?: number[]
}

export function useMouseoverElt() {
  const [mouseoverElt, setMouseoverElt] = useState<string>()
  useEffect(() => {
    function clear() {
      setMouseoverElt(undefined)
    }
    window.addEventListener('wheel', clear, { passive: true })
    return () => {
      window.removeEventListener('wheel', clear)
    }
  }, [])
  return [mouseoverElt, setMouseoverElt] as const
}

// Shared setup for every overlay renderer: the session, hover state, the
// matched features for this track, and the per-render coordinate closures.
// Both VariantOverlay and AlignmentConnections read the same four things off
// the model, so keeping this in one place stops them drifting (e.g. one
// forgetting to thread domYOffsets through).
//
// 'use no memo' is load-bearing. The callers are inline observers, which the
// react compiler leaves alone, but a `use`-prefixed function is a hook and does
// get compiled — and getTrackOverlayData's mobx reads are invisible to it, so
// it memoizes the result on (model, trackId, yOffsetsOverride, domYOffsets).
// None of those change when a view pans or zooms: `model` is an MST node
// mutated in place, and domYOffsets only moves on vertical layout changes. The
// snapshot the call returns (offsetPx/scrollTop/height per level) would then
// stay frozen at first-render values while the getX closure it hands back keeps
// reading bpPerPx live — panning froze the overlay in place and zooming threw
// it millions of px off-screen. See agent-docs/COMPILER_TERNARY_FINDING.md.
export function useOverlayState({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
}: OverlayProps) {
  // eslint-plugin-react-compiler (react-compiler@19.1.0-rc.2) thinks this
  // directive is unused, but the babel plugin (@1.0.0, the real build) DOES
  // compile this hook — version skew, same as DisplayChromeInner. Keep it.
  // eslint-disable-next-line react-compiler/react-compiler
  'use no memo'
  const session = getSession(model)
  const [mouseoverElt, setMouseoverElt] = useMouseoverElt()
  const match = model.overlayMatches.get(trackId)
  const overlayData = model.getTrackOverlayData(
    trackId,
    yOffsetsOverride,
    domYOffsets,
  )
  return { session, mouseoverElt, setMouseoverElt, match, overlayData }
}

function hoverHandlers(
  id: string,
  setMouseoverElt: (id: string | undefined) => void,
) {
  return {
    onMouseOver: () => {
      setMouseoverElt(id)
    },
    onMouseOut: () => {
      setMouseoverElt(undefined)
    },
  }
}

// `getFeatureData` is resolved at click time, not per render: it serializes a
// feature to JSON, and every overlay path in the view would otherwise pay for
// that on every pan/zoom frame to fill in a widget nobody has opened.
export function createVariantMouseHandlers(
  id: string,
  setMouseoverElt: (id: string | undefined) => void,
  session: ReturnType<typeof getSession>,
  getFeatureData: () => unknown,
) {
  return {
    onClick: () => {
      const featureWidget = session.addWidget?.(
        'VariantFeatureWidget',
        'variantFeature',
        { featureData: getFeatureData() },
      )
      session.showWidget?.(featureWidget)
    },
    ...hoverHandlers(id, setMouseoverElt),
  }
}

export function createAlignmentMouseHandlers(
  id: string,
  setMouseoverElt: (id: string | undefined) => void,
  session: ReturnType<typeof getSession>,
  getFeatureData: () => { feature1: unknown; feature2: unknown },
) {
  return {
    onClick: () => {
      const featureWidget = session.addWidget?.(
        'BreakpointAlignmentsWidget',
        'breakpointAlignments',
        { featureData: getFeatureData() },
      )
      session.showWidget?.(featureWidget)
    },
    ...hoverHandlers(id, setMouseoverElt),
  }
}

// A junction whose endpoints share one view level is already drawn by that
// level's pileup when the track links its own reads (view-as-pairs / link
// supplementary alignments): chain layout has its own connecting-line pass (see
// LinearAlignmentsDisplay's showLinkedReadLines). Redrawing it as an overlay
// curve just doubles it up.
//
// It only holds for segments the pileup actually laid out. An off-display one
// (see makeOffscreenLayout) gets no connecting line, so the overlay keeps its
// curve to the track's bottom edge as the only sign the segment exists. A
// segment whose position is merely unknown (no layout yet) never reaches here —
// it's dropped upstream, see layoutUnknown.
export function isDrawnByPileup({
  level,
  levels,
  c1,
  c2,
}: {
  level: number
  levels: OverlayLevel[]
  c1: LayoutRecord
  c2: LayoutRecord
}) {
  return (
    !!levels[level]?.linksReads &&
    !isOffscreenLayout(c1) &&
    !isOffscreenLayout(c2)
  )
}

export function getTestId(trackId: string, hasMatches: boolean) {
  return hasMatches ? `${trackId}-loaded` : trackId
}

export function getCanonicalRefPair(
  assembly: Assembly,
  f1RefName: string,
  f2RefName: string,
) {
  const f1ref = assembly.getCanonicalRefName(f1RefName)
  const f2ref = assembly.getCanonicalRefName(f2RefName)
  if (!f1ref || !f2ref) {
    return undefined
  }
  return { f1ref, f2ref }
}

export function strandToSign(s: string) {
  return s === '+' ? 1 : s === '-' ? -1 : 0
}

function tickX(x: number, sign: number, reversed: boolean | undefined) {
  return x - 20 * sign * (reversed ? -1 : 1)
}

// A view level is horizontally flipped when its px→bp maps to a reversed
// coordinate; an overlay endpoint's tick/handle direction flips with it.
// Takes the per-render plain layouts (getTrackOverlayData) rather than the MST
// views: this resolves once per connection endpoint, and going through the view
// re-reads displayedRegions/bpPerPx/offsetPx through MobX getters every call.
export function isReversed(layouts: ViewLayout[], level: number, x: number) {
  return pxToBp(layouts[level]!, x).reversed
}

// Screen-x of a breakpoint tick mark at endpoint `x` pointing in `sign`
// direction, accounting for a horizontally-flipped view.
export function tickAtPx(
  layouts: ViewLayout[],
  level: number,
  x: number,
  sign: number,
) {
  return tickX(x, sign, isReversed(layouts, level, x))
}

// Flat (y1===y2) connections render as a quadratic arc bowed upward, keeping
// same-row links visible; otherwise a straight line.
const FLAT_ARC_HEIGHT = 30

export function buildSimplePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return y1 === y2
    ? `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 - FLAT_ARC_HEIGHT} ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x2} ${y2}`
}

export function buildBreakpointPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x1Tick: number,
  x2Tick: number,
) {
  return y1 === y2
    ? `M ${x1Tick} ${y1} L ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 - FLAT_ARC_HEIGHT} ${x2} ${y2} L ${x2Tick} ${y2}`
    : `M ${x1Tick} ${y1} L ${x1} ${y1} L ${x2} ${y2} L ${x2Tick} ${y2}`
}

export function featureTooltipLabel(feature: Feature) {
  const name = feature.get('name')
  const loc = assembleLocString({
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
  })
  return name ? `${truncateMiddle(name)} (${loc})` : loc
}

// shared by every overlay type's hover tooltip: two endpoint labels plus an
// optional reason (e.g. why the connecting curve is colored a certain way)
export function buildPairTooltip(
  f1: Feature,
  target: Feature | string,
  reason?: string,
) {
  const f2Label =
    typeof target === 'string' ? target : featureTooltipLabel(target)
  const base = `${featureTooltipLabel(f1)} → ${f2Label}`
  return reason ? `${base}<br/>${reason}` : base
}

export interface PathSpec {
  id: string
  path: string
  tooltip?: string
}

export interface VariantOverlayContext {
  match: OverlayMatch
  assembly: Assembly
  views: BreakpointViewModel['views']
  tracks: ReturnType<BreakpointViewModel['getTrackOverlayData']>['tracks']
  layouts: ReturnType<BreakpointViewModel['getTrackOverlayData']>['layouts']
  getX: ReturnType<BreakpointViewModel['getTrackOverlayData']>['getX']
  getY: ReturnType<BreakpointViewModel['getTrackOverlayData']>['getY']
}

interface VariantOverlayProps extends OverlayProps {
  pathTestId?: string
  render: (ctx: VariantOverlayContext) => PathSpec[]
}

export const VariantOverlay = observer(function VariantOverlay({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
  pathTestId,
  render,
}: VariantOverlayProps) {
  const { interactiveOverlay, views, assembly } = model
  const theme = useTheme()
  const { session, mouseoverElt, setMouseoverElt, match, overlayData } =
    useOverlayState({ model, trackId, yOffsetsOverride, domYOffsets })
  if (!assembly || !match) {
    return null
  }
  const specs = render({ match, assembly, views, ...overlayData })
  const hoveredSpec = specs.find(spec => spec.id === mouseoverElt)
  return (
    <g
      stroke={theme.palette.success.main}
      strokeWidth={5}
      fill="none"
      data-testid={getTestId(trackId, match.layoutMatches.length > 0)}
    >
      {specs.map(({ id, path }) => (
        <path
          d={path}
          data-testid={pathTestId}
          key={id}
          pointerEvents={interactiveOverlay ? 'auto' : undefined}
          strokeWidth={id === mouseoverElt ? 10 : 5}
          {...createVariantMouseHandlers(id, setMouseoverElt, session, () =>
            match.allFeatures.get(id)?.toJSON(),
          )}
        />
      ))}
      {hoveredSpec?.tooltip ? (
        <BreakpointTooltip contents={hoveredSpec.tooltip} />
      ) : null}
    </g>
  )
})

// Only `minimized` is needed, so that's all this asks for — a caller with any
// track-ish thing (including a test double) can use it.
export function isLevelPairMinimized(
  tracks: MinimizableTrack[],
  level1: number,
  level2: number,
) {
  return !!(tracks[level1]?.minimized || tracks[level2]?.minimized)
}

export interface ResolvedPair {
  f1: Feature
  f2: Feature
  level1: number
  level2: number
  c1: LayoutRecord
  c2: LayoutRecord
  f1ref: string
  f2ref: string
  // split-read connectors only: loc strings of this read's segments that map
  // between f1 and f2 but aren't shown in any view, so the connector spans them
  hiddenSegmentsBetween: string[] | undefined
}

// Walks each layoutMatch chunk's adjacent feature pairs, skipping minimized
// level pairs and unresolvable canonical refs. Yields the feature/layout/ref
// data so callers can pick their own endpoint (variant overlays use the LEFT
// edge; AlignmentConnections uses the strand-aware 3'/5' read edges), rather
// than duplicating the walk.
export function* resolvedPairs({
  match,
  assembly,
  tracks,
}: {
  match: Pick<OverlayMatch, 'layoutMatches'>
  assembly: Assembly
  tracks: MinimizableTrack[]
}): Generator<ResolvedPair> {
  for (const chunk of match.layoutMatches) {
    for (let i = 0; i < chunk.length - 1; i++) {
      const { layout: c1, feature: f1, level: level1 } = chunk[i]!
      const {
        layout: c2,
        feature: f2,
        level: level2,
        hiddenSegmentsBefore,
      } = chunk[i + 1]!
      if (isLevelPairMinimized(tracks, level1, level2)) {
        continue
      }
      const refs = getCanonicalRefPair(
        assembly,
        f1.get('refName'),
        f2.get('refName'),
      )
      if (refs) {
        yield {
          f1,
          f2,
          level1,
          level2,
          c1,
          c2,
          hiddenSegmentsBetween: hiddenSegmentsBefore,
          ...refs,
        }
      }
    }
  }
}

// LEFT-edge screen coords for simple variant overlays (paired/breakend), also
// dropping off-view coordinates so callers only describe the path they draw.
export function* canonicalPairs(ctx: VariantOverlayContext) {
  const { getX, getY } = ctx
  for (const { f1, f2, level1, level2, c1, c2, f1ref, f2ref } of resolvedPairs(
    ctx,
  )) {
    const x1 = getX(level1, f1ref, c1[LEFT])
    const x2 = getX(level2, f2ref, c2[LEFT])
    if (x1 == null || x2 == null) {
      continue
    }
    yield {
      f1,
      f2,
      level1,
      level2,
      x1,
      x2,
      y1: getY(level1, c1),
      y2: getY(level2, c2),
      tooltip: buildPairTooltip(f1, f2),
    }
  }
}
