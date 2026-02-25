import type { BreakpointViewModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { getSession } from '@jbrowse/core/util'

export const [LEFT, , RIGHT] = [0, 1, 2, 3] as const

export interface OverlayProps {
  model: BreakpointViewModel
  trackId: string
  parentRef: React.RefObject<SVGSVGElement | null>
  getTrackYPosOverride?: (trackId: string, level: number) => number
}

export function getYOffset(parentRef: React.RefObject<SVGSVGElement | null>) {
  // Reading ref during render is intentional for synchronous positioning
  return parentRef.current?.getBoundingClientRect().top ?? 0
}

export function createMouseHandlers(
  id: string,
  setMouseoverElt: (id: string | undefined) => void,
  session: ReturnType<typeof getSession>,
  widgetType: string,
  widgetId: string,
  featureData: unknown,
) {
  return {
    onClick: () => {
      const featureWidget = session.addWidget?.(widgetType, widgetId, {
        featureData,
      })
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
    throw new Error(`unable to find ref for ${f1ref || f2ref}`)
  }
  return { f1ref, f2ref }
}

export function strandToSign(s: string) {
  return s === '+' ? 1 : s === '-' ? -1 : 0
}

const FLAT_ARC_HEIGHT = 30

function arcOrLine(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2
  return y1 === y2
    ? `Q ${midX} ${y1 - FLAT_ARC_HEIGHT} ${x2} ${y2}`
    : `L ${x2} ${y2}`
}

export function buildSimplePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return `M ${x1} ${y1} ${arcOrLine(x1, y1, x2, y2)}`
}

export function buildBreakpointPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x1Tick: number,
  x2Tick: number,
) {
  return `M ${x1Tick} ${y1} L ${x1} ${y1} ${arcOrLine(x1, y1, x2, y2)} L ${x2Tick} ${y2}`
}
