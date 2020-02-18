/* eslint-disable  no-nested-ternary */
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getSession } from '@gmod/jbrowse-core/util'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { observer } from 'mobx-react'
import { resolveIdentifier } from 'mobx-state-tree'

import React from 'react'
import { yPos, getPxFromCoordinate, cheight } from '../util'
import {
  LinearComparativeViewModel,
  LayoutRecord,
} from '../../LinearComparativeView/model'
import { LinearComparativeTrackModel } from '..'

const [LEFT, , RIGHT] = [0, 1, 2, 3]
type LayoutMatches = {
  layout: LayoutRecord
  feature: Feature
  level: number
  refName: string
}[][]

export default observer(
  ({
    track,
    model,
  }: {
    track: LinearComparativeTrackModel
    model: LinearComparativeViewModel
  }) => {
    const { views } = model
    const trackIds = getConf(track, 'trackIds') as string[]
    const session = getSession(model) as any
    const type = session.pluginManager.pluggableConfigSchemaType('track')
    const subtracks = trackIds.map(trackId =>
      resolveIdentifier(type, session, trackId),
    )
    console.log(subtracks)

    const showIntraviewLinks = false
    const middle = false
    const hideTiny = false
    const layoutMatches: LayoutMatches = []

    if (!layoutMatches.length) {
      return null
    }

    return (
      <g
        stroke="#333"
        fill="none"
        data-testid={
          layoutMatches.length ? `synteny-view-loaded` : 'synteny-view'
        }
      >
        {layoutMatches.map(chunk => {
          const ret = []
          // we follow a path in the list of chunks, not from top to bottom, just in series
          // following x1,y1 -> x2,y2
          for (let i = 0; i < chunk.length - 1; i += 1) {
            const {
              layout: c1,
              feature: f1,
              level: level1,
              refName: ref1,
            } = chunk[i]
            const {
              layout: c2,
              feature: f2,
              level: level2,
              refName: ref2,
            } = chunk[i + 1]

            if (!c1 || !c2) {
              console.warn('received null layout for a overlay feature')
              return null
            }

            // disable rendering connections in a single level
            if (!showIntraviewLinks && level1 === level2) {
              return null
            }
            const l1 = f1.get('end') - f1.get('start')
            const l2 = f2.get('end') - f2.get('start')
            let tiny = false

            if (l1 < views[level1].bpPerPx || l2 < views[level2].bpPerPx) {
              tiny = true
              if (hideTiny) {
                // eslint-disable-next-line no-continue
                continue
              }
            }
            if (!model.refNames[level1].includes(ref1)) {
              //  eslint-disable-next-line no-continue
              continue
            }
            if (!model.refNames[level2].includes(ref2)) {
              //   eslint-disable-next-line no-continue
              continue
            }

            const x11 = getPxFromCoordinate(views[level1], ref1, c1[LEFT])
            const x12 = getPxFromCoordinate(views[level1], ref1, c1[RIGHT])
            const x21 = getPxFromCoordinate(views[level2], ref2, c2[LEFT])
            const x22 = getPxFromCoordinate(views[level2], ref2, c2[RIGHT])

            const nv = subtracks.map(v => v.view)
            const nt = subtracks.map(v => v.track)
            const nc = subtracks.filter(f => !!f.track)

            const y1 = middle
              ? level1 < level2
                ? 0
                : 150
              : yPos(getConf(nc[0].track, 'trackId'), level1, nv, nt, c1) +
                (level1 < level2 ? cheight(c1) : 0)
            const y2 = middle
              ? level2 < level1
                ? 0
                : 150
              : yPos(getConf(nc[1].track, 'trackId'), level2, nv, nt, c2) +
                (level2 < level1 ? cheight(c2) : 0)

            ret.push(
              <polygon
                key={`${f1.id()}-${f2.id()}`}
                points={`${x11},${y1} ${x12},${y1} ${x22},${y2}, ${x21},${y2}`}
                style={{
                  fill: 'rgba(255,100,100,0.3)',
                  stroke: tiny ? 'rgba(50,50,50,0.1)' : undefined,
                }}
              />,
            )
          }
          return ret
        })}
      </g>
    )
  },
)
