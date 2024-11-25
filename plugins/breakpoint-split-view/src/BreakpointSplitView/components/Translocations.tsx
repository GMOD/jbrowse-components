import React, { useState, useMemo } from 'react'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

// locals
import { getMatchedTranslocationFeatures } from './util'
import { yPos, getPxFromCoordinate, useNextFrame } from '../util'
import type { BreakpointViewModel, LayoutRecord } from '../model'

const [LEFT] = [0, 1, 2, 3] as const

function str(s: string) {
  if (s === '+') {
    return 1
  } else if (s === '-') {
    return -1
  } else {
    return 0
  }
}

const Translocations = observer(function ({
  model,
  trackId,
  parentRef: ref,
  getTrackYPosOverride,
}: {
  model: BreakpointViewModel
  trackId: string
  parentRef: React.RefObject<SVGSVGElement>
  getTrackYPosOverride?: (trackId: string, level: number) => number
}) {
  const { views } = model
  const session = getSession(model)
  const { assemblyManager } = session
  const totalFeatures = model.getTrackFeatures(trackId)
  const layoutMatches = useMemo(
    () =>
      model.getMatchedFeaturesInLayout(
        trackId,
        getMatchedTranslocationFeatures(totalFeatures),
      ),

    [totalFeatures, trackId, model],
  )

  const [mouseoverElt, setMouseoverElt] = useState<string>()
  const snap = getSnapshot(model)
  useNextFrame(snap)

  const assembly = assemblyManager.get(views[0]!.assemblyNames[0]!)
  if (!assembly) {
    return null
  }

  let yOffset = 0
  if (ref.current) {
    const rect = ref.current.getBoundingClientRect()
    yOffset = rect.top
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
          const res = info.STRANDS?.[0]?.split('') // not all files have STRANDS
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

            const tracks = views.map(v => v.getTrack(trackId))
            const y1 =
              yPos(trackId, level1, views, tracks, c1, getTrackYPosOverride) -
              yOffset
            const y2 =
              yPos(trackId, level2, views, tracks, c2, getTrackYPosOverride) -
              yOffset

            const path = [
              'M', // move to
              x1 - 20 * str(myDirection) * (reversed1 ? -1 : 1),
              y1,
              'L', // line to
              x1,
              y1,
              'L', // line to as const
              x2,
              y2,
              'L', // line to
              x2 - 20 * str(mateDirection) * (reversed2 ? -1 : 1),
              y2,
            ].join(' ')
            ret.push(
              <path
                d={path}
                key={JSON.stringify(path)}
                strokeWidth={id === mouseoverElt ? 10 : 5}
                onClick={() => {
                  const featureWidget = session.addWidget?.(
                    'VariantFeatureWidget',
                    'variantFeature',
                    {
                      featureData: (
                        totalFeatures.get(id) || { toJSON: () => {} }
                      ).toJSON(),
                    },
                  )
                  session.showWidget?.(featureWidget)
                }}
                onMouseOver={() => {
                  setMouseoverElt(id)
                }}
                onMouseOut={() => {
                  setMouseoverElt(undefined)
                }}
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
