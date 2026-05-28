import { useEffect, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { BreakpointViewModel } from '../model.ts'
import type { OverlayMatch } from '../types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

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
    onMouseOver: () => {
      setMouseoverElt(id)
    },
    onMouseOut: () => {
      setMouseoverElt(undefined)
    },
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

export function tickX(x: number, sign: number, reversed: boolean | undefined) {
  return x - 20 * sign * (reversed ? -1 : 1)
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

export interface PathSpec {
  id: string
  path: string
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
  const session = getSession(model)
  const [mouseoverElt, setMouseoverElt] = useMouseoverElt()
  const match = model.overlayMatches.get(trackId)
  const overlayData = model.getTrackOverlayData(
    trackId,
    yOffsetsOverride,
    domYOffsets,
  )
  if (!assembly || !match) {
    return null
  }
  const specs = render({ match, assembly, views, ...overlayData })
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
          key={path}
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
