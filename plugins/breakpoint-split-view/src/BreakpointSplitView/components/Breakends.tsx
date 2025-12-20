import { useMemo, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import {
  LEFT,
  createMouseHandlers,
  getCanonicalRefs,
  getTestId,
  getYOffset,
} from './overlayUtils'
import { findMatchingAlt, getMatchedBreakendFeatures } from './util'
import { getPxFromCoordinate, useNextFrame, yPos } from '../util'

import type { OverlayProps } from './overlayUtils'

const Breakends = observer(function ({
  model,
  trackId,
  parentRef,
  getTrackYPosOverride,
}: OverlayProps) {
  const { interactiveOverlay, views } = model
  const session = getSession(model)
  const { assemblyManager } = session
  const snap = getSnapshot(model)
  const v0 = views[0]
  const assembly = v0 ? assemblyManager.get(v0.assemblyNames[0]!) : undefined
  useNextFrame(snap)
  const totalFeatures = model.getTrackFeatures(trackId)

  const layoutMatches = useMemo(() => {
    const matchedFeatures = getMatchedBreakendFeatures(totalFeatures)
    return model.getMatchedFeaturesInLayout(trackId, matchedFeatures)
  }, [totalFeatures, trackId, model])

  const [mouseoverElt, setMouseoverElt] = useState<string>()
  const yOffset = getYOffset(parentRef)
  const tracks = views.map(v => v.getTrack(trackId))

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

          const relevantAlt = findMatchingAlt(f1, f2)
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
            yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) -
            yOffset
          const y2 =
            yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) -
            yOffset

          if (!relevantAlt) {
            console.warn('the relevant ALT allele was not found, cannot render')
          } else {
            const path = [
              'M',
              x1 -
                20 *
                  (relevantAlt.Join === 'left' ? -1 : 1) *
                  (reversed1 ? -1 : 1),
              y1,
              'L',
              x1,
              y1,
              'L',
              x2,
              y2,
              'L',
              x2 -
                20 *
                  (relevantAlt.MateDirection === 'left' ? 1 : -1) *
                  (reversed2 ? -1 : 1),
              y2,
            ].join(' ')

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
                pointerEvents={interactiveOverlay ? 'auto' : undefined}
                key={JSON.stringify(path)}
                strokeWidth={id === mouseoverElt ? 10 : 5}
                {...mouseHandlers}
              />,
            )
          }
        }
        return ret
      })}
    </g>
  )
})

export default Breakends
