import { useEffect, useState } from 'react'

import type { BreakpointViewModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { getSession } from '@jbrowse/core/util'

export const [LEFT, , RIGHT] = [0, 1, 2, 3] as const

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

export function getCanonicalRefs(
  assembly: Assembly,
  f1RefName: string,
  f2RefName: string,
) {
  const f1ref = assembly.getCanonicalRefName(f1RefName)
  const f2ref = assembly.getCanonicalRefName(f2RefName)
  if (!f1ref || !f2ref) {
    throw new Error(
      `unable to find canonical ref for ${!f1ref ? f1RefName : f2RefName}`,
    )
  }
  return { f1ref, f2ref }
}

export function strandToSign(s: string) {
  return s === '+' ? 1 : s === '-' ? -1 : 0
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
