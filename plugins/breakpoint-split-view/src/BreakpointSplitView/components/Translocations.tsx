import { useMemo, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildBreakpointPath,
  createVariantMouseHandlers,
  getTestId,
  strandToSign,
} from './overlayUtils.tsx'
import { getMatchedTranslocationFeatures } from './util.ts'
import { getPxFromCoordinate, getTrackHeightsCache, yPos } from '../util.ts'

import type { OverlayProps } from './overlayUtils.tsx'
import type { LayoutRecord } from '../types.ts'

const Translocations = observer(function Translocations({
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
    const matchedFeatures = getMatchedTranslocationFeatures(totalFeatures)
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

  // we hardcode the TRA to go to the "other view" and if there is none, we
  // just return null here note: would need to do processing of the INFO
  // CHR2/END and see which view could contain those coordinates to really do
  // it properly
  if (views.length < 2) {
    return null
  }

  return (
    <g
      fill="none"
      stroke="green"
      strokeWidth={5}
      data-testid={getTestId(trackId, layoutMatches.length > 0)}
    >
      {layoutMatches.map(chunk => {
        const ret = []
        for (const { layout: c1, feature: f1, level: level1 } of chunk) {
          const level2 = level1 === 0 ? 1 : 0
          const id = f1.id()

          const info = f1.get('INFO')
          const chr2 = info.CHR2[0]
          const end2 = info.END[0]
          const res = info.STRANDS?.[0]?.split('')
          const [myDirection, mateDirection] = res ?? ['.', '.']

          const r = getPxFromCoordinate(views[level2]!, chr2, end2)
          if (r) {
            const c2: LayoutRecord = [r, 0, r + 1, 0]
            const x1 = getPxFromCoordinate(
              views[level1]!,
              f1.get('refName'),
              c1[LEFT],
            )
            const x2 = r
            const reversed1 = views[level1]!.pxToBp(x1).reversed
            const reversed2 = views[level2]!.pxToBp(x2).reversed

            const y1 =
              yPos(level1, tracks, c1, cachedHeights, hasOverride) - yOffset
            const y2 =
              yPos(level2, tracks, c2, cachedHeights, hasOverride) - yOffset

            const x1Tick =
              x1 - 20 * strandToSign(myDirection) * (reversed1 ? -1 : 1)
            const x2Tick =
              x2 - 20 * strandToSign(mateDirection) * (reversed2 ? -1 : 1)
            const path = buildBreakpointPath(x1, y1, x2, y2, x1Tick, x2Tick)

            const mouseHandlers = createVariantMouseHandlers(
              id,
              setMouseoverElt,
              session,
              totalFeatures.get(id)?.toJSON(),
            )

            ret.push(
              <path
                d={path}
                key={JSON.stringify(path)}
                pointerEvents={interactiveOverlay ? 'auto' : undefined}
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

export default Translocations
