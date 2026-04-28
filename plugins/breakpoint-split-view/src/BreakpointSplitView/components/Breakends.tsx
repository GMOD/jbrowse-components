import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildBreakpointPath,
  createVariantMouseHandlers,
  getCanonicalRefs,
  getTestId,
  useMouseoverElt,
} from './overlayUtils.tsx'
import { findMatchingAlt } from './util.ts'

import type { OverlayProps } from './overlayUtils.tsx'

const Breakends = observer(function Breakends({
  model,
  trackId,
  yOffsetsOverride,
}: OverlayProps) {
  const { interactiveOverlay, views, assembly } = model
  const session = getSession(model)
  const [mouseoverElt, setMouseoverElt] = useMouseoverElt()
  const match = model.overlayMatches.get(trackId)
  const { tracks, getX, getY } = model.getTrackOverlayData(
    trackId,
    yOffsetsOverride,
  )
  const layoutMatches = match?.layoutMatches ?? []
  const totalFeatures = match?.allFeatures

  return assembly && match ? (
    <g
      stroke="green"
      strokeWidth={5}
      fill="none"
      data-testid={getTestId(trackId, layoutMatches.length > 0)}
    >
      {layoutMatches.flatMap(chunk =>
        chunk.slice(0, -1).flatMap((item, i) => {
          const { layout: c1, feature: f1, level: level1 } = item
          const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!

          if (tracks[level1]?.minimized || tracks[level2]?.minimized) {
            return []
          }
          const id = f1.id()

          const relevantAlt = findMatchingAlt(f1, f2)
          if (!relevantAlt) {
            console.warn('the relevant ALT allele was not found, cannot render')
            return []
          }

          const { f1ref, f2ref } = getCanonicalRefs(
            assembly,
            f1.get('refName'),
            f2.get('refName'),
          )
          const x1 = getX(level1, f1ref, c1[LEFT]) ?? 0
          const x2 = getX(level2, f2ref, c2[LEFT]) ?? 0
          const reversed1 = views[level1]!.pxToBp(x1).reversed
          const reversed2 = views[level2]!.pxToBp(x2).reversed

          const y1 = getY(level1, c1)
          const y2 = getY(level2, c2)
          const x1Tick =
            x1 -
            20 * (relevantAlt.Join === 'left' ? -1 : 1) * (reversed1 ? -1 : 1)
          const x2Tick =
            x2 -
            20 *
              (relevantAlt.MateDirection === 'left' ? 1 : -1) *
              (reversed2 ? -1 : 1)
          const path = buildBreakpointPath(x1, y1, x2, y2, x1Tick, x2Tick)

          return [
            <path
              d={path}
              data-testid="r2"
              pointerEvents={interactiveOverlay ? 'auto' : undefined}
              key={JSON.stringify(path)}
              strokeWidth={id === mouseoverElt ? 10 : 5}
              {...createVariantMouseHandlers(
                id,
                setMouseoverElt,
                session,
                totalFeatures?.get(id)?.toJSON(),
              )}
            />,
          ]
        }),
      )}
    </g>
  ) : null
})

export default Breakends
