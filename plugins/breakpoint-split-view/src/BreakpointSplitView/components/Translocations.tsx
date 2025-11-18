import { useMemo } from 'react'

import { observer } from 'mobx-react'

import InteractivePath from './InteractivePath'
import { getViewCoordinates } from './coordinateUtils'
import { getMatchedTranslocationFeatures } from './featureMatching'
import { useMouseoverTracking, useOverlaySetup } from './hooks'
import { strandSymbolToDirection } from './strandUtils'
import { showVariantFeatureWidget } from './widgetUtils'
import { DIRECTION_INDICATOR_LENGTH, LAYOUT_LEFT } from '../constants'
import { getPxFromCoordinate, yPos } from '../util'

import type { BreakpointViewModel } from '../model'
import type { LayoutRecord } from '../types'

const Translocations = observer(function ({
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
        getMatchedTranslocationFeatures(totalFeatures),
      ),
    [totalFeatures, trackId, model],
  )

  const { session } = useOverlaySetup(model)
  const { mouseoverElt, handlers } = useMouseoverTracking()

  let yOffset = 0
  if (parentRef.current) {
    const rect = parentRef.current.getBoundingClientRect()
    yOffset = rect.top
  }

  const tracks = useMemo(
    () => views.map(v => v.getTrack(trackId)),
    [views, trackId],
  )

  if (views.length < 2) {
    return null
  }
  return (
    <g
      fill="none"
      stroke="green"
      strokeWidth={5}
      data-testid={layoutMatches.length ? `${trackId}-loaded` : trackId}
    >
      {layoutMatches.map(chunk => {
        // we follow a path in the list of chunks, not from top to bottom,
        // just in series following x1,y1 -> x2,y2
        const ret = []
        for (const { layout: c1, feature: f1, level: level1 } of chunk) {
          const level2 = level1 === 0 ? 1 : 0
          const id = f1.id()
          if (!c1) {
            return null
          }

          const info = f1.get('INFO')
          const chr2 = info.CHR2[0]
          const end2 = info.END[0]
          const res = info.STRANDS?.[0]?.split('')
          const [myDirection, mateDirection] = res ?? ['.', '.']

          const r = getPxFromCoordinate(views[level2]!, chr2, end2)
          if (r) {
            const c2: LayoutRecord = [r, 0, r + 1, 0]
            const { px: x1, reversalFactor: rf1 } = getViewCoordinates(
              views[level1]!,
              f1.get('refName'),
              c1[LAYOUT_LEFT],
            )
            const { reversalFactor: rf2 } = getViewCoordinates(
              views[level2]!,
              chr2,
              r,
            )
            const x2 = r

            const y1 =
              yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) -
              yOffset
            const y2 =
              yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) -
              yOffset

            const path = [
              'M',
              x1 -
                DIRECTION_INDICATOR_LENGTH *
                  strandSymbolToDirection(myDirection) *
                  rf1,
              y1,
              'L',
              x1,
              y1,
              'L',
              x2,
              y2,
              'L',
              x2 -
                DIRECTION_INDICATOR_LENGTH *
                  strandSymbolToDirection(mateDirection) *
                  rf2,
              y2,
            ].join(' ')
            ret.push(
              <InteractivePath
                pathData={path}
                key={JSON.stringify(path)}
                interactiveOverlay={interactiveOverlay}
                isHovered={id === mouseoverElt}
                onClick={() => {
                  showVariantFeatureWidget(session, totalFeatures.get(id))
                }}
                onMouseOverCallback={handlers.onMouseOver(id)}
                onMouseOutCallback={handlers.onMouseOut()}
              />,
            )
          }
        }
        return ret
      })}
    </g>
  )
})

export default Translocations
