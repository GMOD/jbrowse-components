import { observer } from 'mobx-react'

import {
  LEFT,
  calculateYPositions,
  createMouseHandlers,
  getCanonicalRefs,
  getTestId,
  useBreakpointOverlaySetup,
} from './useBreakpointOverlay'
import { getMatchedPairedFeatures } from './util'
import { getPxFromCoordinate } from '../util'

import type { OverlayProps } from './useBreakpointOverlay'

const PairedFeatures = observer(function ({
  model,
  trackId,
  parentRef,
  getTrackYPosOverride,
}: OverlayProps) {
  const { interactiveOverlay, views } = model
  const totalFeatures = model.getTrackFeatures(trackId)
  const {
    session,
    assembly,
    layoutMatches,
    mouseoverElt,
    setMouseoverElt,
    yOffset,
  } = useBreakpointOverlaySetup(
    model,
    trackId,
    parentRef,
    getMatchedPairedFeatures,
    totalFeatures,
  )

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
      {layoutMatches.map(chunk => {
        const ret = []
        for (let i = 0; i < chunk.length - 1; i += 1) {
          const { layout: c1, feature: f1, level: level1 } = chunk[i]!
          const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!
          const id = f1.id()

          if (!c1 || !c2) {
            return null
          }

          const { f1ref, f2ref } = getCanonicalRefs(
            assembly,
            f1.get('refName'),
            f2.get('refName'),
          )
          const x1 = getPxFromCoordinate(views[level1]!, f1ref, c1[LEFT])
          const x2 = getPxFromCoordinate(views[level2]!, f2ref, c2[LEFT])

          const { y1, y2 } = calculateYPositions(
            trackId,
            level1,
            level2,
            views,
            c1,
            c2,
            yOffset,
            getTrackYPosOverride,
          )

          const path = ['M', x1, y1, 'L', x2, y2].join(' ')
          const mouseHandlers = createMouseHandlers(
            id,
            setMouseoverElt,
            session,
            'VariantFeatureWidget',
            'variantFeature',
            totalFeatures.get(id)?.toJSON(),
          )

          ret.push(
            <path
              d={path}
              data-testid="r2"
              key={JSON.stringify(path)}
              pointerEvents={interactiveOverlay ? 'auto' : undefined}
              strokeWidth={id === mouseoverElt ? 10 : 5}
              {...mouseHandlers}
            />,
          )
        }
        return ret
      })}
    </g>
  )
})

export default PairedFeatures
