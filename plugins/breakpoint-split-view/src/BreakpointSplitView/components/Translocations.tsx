import { useMemo, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import {
  LEFT,
  buildBreakpointPath,
  createMouseHandlers,
  getTestId,
  getYOffset,
} from './overlayUtils'
import { getMatchedTranslocationFeatures } from './util'
import { getPxFromCoordinate, useNextFrame, yPos } from '../util'

import type { OverlayProps } from './overlayUtils'
import type { LayoutRecord } from '../types'

function str(s: string) {
  return s === '+' ? 1 : s === '-' ? -1 : 0
}

const Translocations = observer(function Translocations({
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
    const matchedFeatures = getMatchedTranslocationFeatures(totalFeatures)
    return model.getMatchedFeaturesInLayout(trackId, matchedFeatures)
  }, [totalFeatures, trackId, model])

  const [mouseoverElt, setMouseoverElt] = useState<string>()
  const yOffset = getYOffset(parentRef)
  const tracks = views.map(v => v.getTrack(trackId))

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
              yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) -
              yOffset
            const y2 =
              yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) -
              yOffset

            const x1Tick = x1 - 20 * str(myDirection) * (reversed1 ? -1 : 1)
            const x2Tick = x2 - 20 * str(mateDirection) * (reversed2 ? -1 : 1)
            const path = buildBreakpointPath(x1, y1, x2, y2, x1Tick, x2Tick)

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
