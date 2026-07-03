import { useEffect, useState } from 'react'

import {
  assembleLocString,
  getSession,
  truncateMiddle,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import BreakpointTooltip from './BreakpointTooltip.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { LayoutRecord, OverlayMatch } from '../types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

export const LEFT = 0
export const RIGHT = 2

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
export function useOverlayState({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
}: OverlayProps) {
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

export function createVariantMouseHandlers(
  id: string,
  setMouseoverElt: (id: string | undefined) => void,
  session: ReturnType<typeof getSession>,
  featureData: unknown,
) {
  return {
    onClick: () => {
      const featureWidget = session.addWidget?.(
        'VariantFeatureWidget',
        'variantFeature',
        { featureData },
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
  feature1: unknown,
  feature2: unknown,
) {
  return {
    onClick: () => {
      const featureWidget = session.addWidget?.(
        'BreakpointAlignmentsWidget',
        'breakpointAlignments',
        { featureData: { feature1, feature2 } },
      )
      session.showWidget?.(featureWidget)
    },
    ...hoverHandlers(id, setMouseoverElt),
  }
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
export function isReversed(
  views: BreakpointViewModel['views'],
  level: number,
  x: number,
) {
  return views[level]!.pxToBp(x).reversed
}

// Screen-x of a breakpoint tick mark at endpoint `x` pointing in `sign`
// direction, accounting for a horizontally-flipped view.
export function tickAtPx(
  views: BreakpointViewModel['views'],
  level: number,
  x: number,
  sign: number,
) {
  return tickX(x, sign, isReversed(views, level, x))
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
          {...createVariantMouseHandlers(
            id,
            setMouseoverElt,
            session,
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

export function isLevelPairMinimized(
  tracks: VariantOverlayContext['tracks'],
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
  tracks: VariantOverlayContext['tracks']
}): Generator<ResolvedPair> {
  for (const chunk of match.layoutMatches) {
    for (let i = 0; i < chunk.length - 1; i++) {
      const { layout: c1, feature: f1, level: level1 } = chunk[i]!
      const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!
      if (isLevelPairMinimized(tracks, level1, level2)) {
        continue
      }
      const refs = getCanonicalRefPair(
        assembly,
        f1.get('refName'),
        f2.get('refName'),
      )
      if (refs) {
        yield { f1, f2, level1, level2, c1, c2, ...refs }
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
