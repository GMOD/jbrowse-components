import { useMemo, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { useNextFrame, yPos } from '../util'

import type { BreakpointViewModel } from '../model'
import type { LayoutRecord } from '../types'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

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

export function useBreakpointOverlaySetup(
  model: BreakpointViewModel,
  trackId: string,
  parentRef: React.RefObject<SVGSVGElement | null>,
  getMatchedFeatures: (features: Map<string, Feature>) => Feature[][],
  totalFeatures: Map<string, Feature>,
) {
  const { views } = model
  const session = getSession(model)
  const { assemblyManager } = session

  const layoutMatches = useMemo(() => {
    const matchedFeatures = getMatchedFeatures(totalFeatures)
    return model.getMatchedFeaturesInLayout(trackId, matchedFeatures)
  }, [totalFeatures, trackId, model, getMatchedFeatures])

  const [mouseoverElt, setMouseoverElt] = useState<string>()
  const snap = getSnapshot(model)
  useNextFrame(snap)

  const v0 = views[0]
  const assembly = v0 ? assemblyManager.get(v0.assemblyNames[0]!) : undefined
  const yOffset = getYOffset(parentRef)

  return {
    session,
    assembly,
    layoutMatches,
    mouseoverElt,
    setMouseoverElt,
    yOffset,
  }
}

export function calculateYPositions(
  trackId: string,
  level1: number,
  level2: number,
  views: BreakpointViewModel['views'],
  c1: LayoutRecord,
  c2: LayoutRecord,
  yOffset: number,
  getTrackYPosOverride?: (trackId: string, level: number) => number,
) {
  const tracks = views.map(v => v.getTrack(trackId))
  return {
    y1: yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) - yOffset,
    y2: yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) - yOffset,
  }
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
