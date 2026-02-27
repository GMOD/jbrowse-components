import { useMemo, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildSimplePath,
  createMouseHandlers,
  getCanonicalRefs,
  getTestId,
} from './overlayUtils.tsx'
import { getMatchedPairedFeatures } from './util.ts'
import { getPxFromCoordinate, getTrackHeightsCache, yPos } from '../util.ts'

import type { OverlayProps } from './overlayUtils.tsx'

const PairedFeatures = observer(function PairedFeatures({
  model,
  trackId,
  getTrackYPosOverride,
  cachedTrackTops,
  cachedYOffset,
}: OverlayProps) {
  const { interactiveOverlay, views } = model
  const session = getSession(model)
  const { assemblyManager } = session
  const v0 = views[0]
  const assembly = v0 ? assemblyManager.get(v0.assemblyNames[0]!) : undefined
  const totalFeatures = model.getTrackFeatures(trackId)

  const layoutMatches = useMemo(() => {
    const matchedFeatures = getMatchedPairedFeatures(totalFeatures)
    return model.getMatchedFeaturesInLayout(trackId, matchedFeatures)
  }, [totalFeatures, trackId, model])

  const [mouseoverElt, setMouseoverElt] = useState<string>()
  const yOffset = cachedYOffset ?? 0
  const tracks = views.map(v => v.getTrack(trackId))
  const hasOverride = !!getTrackYPosOverride
  const cachedHeights =
    cachedTrackTops ??
    getTrackHeightsCache(views, trackId, getTrackYPosOverride)

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
          const { f1ref, f2ref } = getCanonicalRefs(
            assembly,
            f1.get('refName'),
            f2.get('refName'),
          )
          const x1 = getPxFromCoordinate(views[level1]!, f1ref, c1[LEFT])
          const x2 = getPxFromCoordinate(views[level2]!, f2ref, c2[LEFT])

          const y1 =
            yPos(level1, tracks, c1, cachedHeights, hasOverride) - yOffset
          const y2 =
            yPos(level2, tracks, c2, cachedHeights, hasOverride) - yOffset

          const path = buildSimplePath(x1, y1, x2, y2)
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
