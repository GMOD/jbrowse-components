import { useMemo } from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildBreakpointPath,
  createVariantMouseHandlers,
  getCanonicalRefs,
  getTestId,
  useOverlaySetup,
} from './overlayUtils.tsx'
import { findMatchingAlt, getMatchedBreakendFeatures } from './util.ts'
import { getPxFromCoordinate, yPos } from '../util.ts'

import type { OverlayProps } from './overlayUtils.tsx'

const Breakends = observer(function Breakends(props: OverlayProps) {
  const { model, trackId } = props
  const { interactiveOverlay, views, assembly } = model
  const session = getSession(model)
  const totalFeatures = model.getTrackFeatures(trackId)

  const layoutMatches = useMemo(() => {
    const matchedFeatures = getMatchedBreakendFeatures(totalFeatures)
    return model.getMatchedFeaturesInLayout(trackId, matchedFeatures)
  }, [totalFeatures, trackId, model])

  const {
    mouseoverElt,
    setMouseoverElt,
    yOffset,
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
          const x1 = getPxFromCoordinate(views[level1]!, f1ref, c1[LEFT])
          const x2 = getPxFromCoordinate(views[level2]!, f2ref, c2[LEFT])
          const reversed1 = views[level1]!.pxToBp(x1).reversed
          const reversed2 = views[level2]!.pxToBp(x2).reversed

          const y1 =
            yPos(level1, tracks, c1, cachedHeights, hasOverride) - yOffset
          const y2 =
            yPos(level2, tracks, c2, cachedHeights, hasOverride) - yOffset

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
                totalFeatures.get(id)?.toJSON(),
              )}
            />,
          ]
        }),
      )}
    </g>
  )
})

export default Breakends
