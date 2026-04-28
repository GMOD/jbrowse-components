import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildSimplePath,
  createVariantMouseHandlers,
  getCanonicalRefs,
  getTestId,
  useMouseoverElt,
} from './overlayUtils.tsx'

import type { OverlayProps } from './overlayUtils.tsx'

const PairedFeatures = observer(function PairedFeatures({
  model,
  trackId,
  yOffsetsOverride,
}: OverlayProps) {
  const { interactiveOverlay, assembly } = model
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
          const { f1ref, f2ref } = getCanonicalRefs(
            assembly,
            f1.get('refName'),
            f2.get('refName'),
          )
          const x1 = getX(level1, f1ref, c1[LEFT]) ?? 0
          const x2 = getX(level2, f2ref, c2[LEFT]) ?? 0
          const y1 = getY(level1, c1)
          const y2 = getY(level2, c2)
          const path = buildSimplePath(x1, y1, x2, y2)
          return [
            <path
              d={path}
              data-testid="r2"
              key={JSON.stringify(path)}
              pointerEvents={interactiveOverlay ? 'auto' : undefined}
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

export default PairedFeatures
