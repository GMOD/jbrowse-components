import { useMemo } from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildSimplePath,
  createVariantMouseHandlers,
  getCanonicalRefs,
  getTestId,
  useOverlaySetup,
} from './overlayUtils.tsx'
import { getMatchedPairedFeatures } from './util.ts'
import { getPxFromCoordinate, yPos } from '../util.ts'

import type { OverlayProps } from './overlayUtils.tsx'

const PairedFeatures = observer(function PairedFeatures(props: OverlayProps) {
  const { model, trackId } = props
  const { interactiveOverlay, views, assembly } = model
  const session = getSession(model)
  const totalFeatures = model.getTrackFeatures(trackId)

  const layoutMatches = useMemo(() => {
    const matchedFeatures = getMatchedPairedFeatures(totalFeatures)
    return model.getMatchedFeaturesInLayout(trackId, matchedFeatures)
  }, [totalFeatures, trackId, model])

  const {
    mouseoverElt,
    setMouseoverElt,
    tracks,
    hasOverride,
    cachedHeights,
  } = useOverlaySetup(props)

  if (!assembly) {
    return null
  }

  return (
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
          const x1 = getPxFromCoordinate(views[level1]!, f1ref, c1[LEFT])
          const x2 = getPxFromCoordinate(views[level2]!, f2ref, c2[LEFT])

          const y1 = yPos(level1, tracks, c1, cachedHeights, hasOverride)
          const y2 = yPos(level2, tracks, c2, cachedHeights, hasOverride)
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
                totalFeatures.get(id)?.toJSON(),
              )}
            />,
          ]
        }),
      )}
    </g>
  )
})

export default PairedFeatures
