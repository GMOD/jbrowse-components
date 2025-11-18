import { useMemo } from 'react'

import { observer } from 'mobx-react'

import { getCanonicalRefNames } from './assemblyUtils'
import { getViewCoordinates } from './coordinateUtils'
import { getMatchedPairedFeatures } from './featureMatching'
import { useMouseoverTracking, useOverlaySetup } from './hooks'
import { getInteractivePathProps } from './pathUtils'
import { showVariantFeatureWidget } from './widgetUtils'
import { LAYOUT_LEFT } from '../constants'
import { yPos } from '../util'

import type { BreakpointViewModel } from '../model'

const PairedFeatures = observer(function ({
  model,
  trackId,
  parentRef,
  getTrackYPosOverride,
}: {
  model: BreakpointViewModel
  trackId: string
  parentRef: React.RefObject<SVGSVGElement | null>
  getTrackYPosOverride?: (trackId: string, level: number) => number
}) {
  const { interactiveOverlay, views } = model
  const totalFeatures = model.getTrackFeatures(trackId)
  const layoutMatches = useMemo(
    () =>
      model.getMatchedFeaturesInLayout(
        trackId,
        getMatchedPairedFeatures(totalFeatures),
      ),
    [totalFeatures, trackId, model],
  )

  const { session, assembly } = useOverlaySetup(model)
  const { mouseoverElt, handlers } = useMouseoverTracking()

  let yOffset = 0
  if (parentRef.current) {
    const rect = parentRef.current.getBoundingClientRect()
    yOffset = rect.top
  }

  const tracks = views.map(v => v.getTrack(trackId))

  if (!assembly) {
    return null
  }

  return (
    <g
      stroke="green"
      strokeWidth={5}
      fill="none"
      data-testid={layoutMatches.length ? `${trackId}-loaded` : trackId}
    >
      {layoutMatches.map(chunk => {
        const ret = []
        // we follow a path in the list of chunks, not from top to bottom, just
        // in series following x1,y1 -> x2,y2
        for (let i = 0; i < chunk.length - 1; i += 1) {
          const { layout: c1, feature: f1, level: level1 } = chunk[i]!
          const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!
          const id = f1.id()

          if (!c1 || !c2) {
            return null
          }

          const { f1ref, f2ref } = getCanonicalRefNames(assembly, f1, f2)
          const { px: x1 } = getViewCoordinates(
            views[level1]!,
            f1ref,
            c1[LAYOUT_LEFT],
          )
          const { px: x2 } = getViewCoordinates(
            views[level2]!,
            f2ref,
            c2[LAYOUT_LEFT],
          )

          const y1 =
            yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) -
            yOffset
          const y2 =
            yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) -
            yOffset

          const path = ['M', x1, y1, 'L', x2, y2].join(' ')
          ret.push(
            <path
              d={path}
              data-testid="r2"
              key={JSON.stringify(path)}
              {...getInteractivePathProps({
                interactiveOverlay,
                isHovered: id === mouseoverElt,
              })}
              onClick={() => {
                showVariantFeatureWidget(session, totalFeatures.get(id))
              }}
              onMouseOver={handlers.onMouseOver(id)}
              onMouseOut={handlers.onMouseOut()}
            />,
          )
        }
        return ret
      })}
    </g>
  )
})

export default PairedFeatures
