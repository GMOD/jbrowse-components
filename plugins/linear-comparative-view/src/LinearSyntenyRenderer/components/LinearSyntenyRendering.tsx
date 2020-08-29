/* eslint-disable no-continue */
import React, { useRef, useMemo, useEffect } from 'react'
import { observer } from 'mobx-react'
import SimpleFeature, {
  SimpleFeatureSerialized,
  Feature,
} from '@gmod/jbrowse-core/util/simpleFeature'

import { getConf } from '@gmod/jbrowse-core/configuration'
import { getContainingView } from '@gmod/jbrowse-core/util'
import { LinearGenomeViewModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { Shape, Surface } from 'react-art'
import Path from 'paths-js/path'
import { interstitialYPos, overlayYPos, generateMatches } from '../../util'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import { LinearSyntenyTrackModel } from '../../LinearSyntenyTrack'

require('art/modes/canvas')

const [LEFT, , RIGHT] = [0, 1, 2, 3]

type RectTuple = [number, number, number, number]

function px(
  view: LinearGenomeViewModel,
  arg: { refName: string; coord: number },
) {
  return (view.bpToPx(arg) || {}).offsetPx || 0
}

function layoutMatches(features: Feature[][]) {
  const matches = []
  for (let i = 0; i < features.length; i++) {
    for (let j = i; j < features.length; j++) {
      if (i !== j) {
        for (const [f1, f2] of generateMatches(features[i], features[j], feat =>
          feat.get('syntenyId'),
        )) {
          matches.push([
            {
              feature: f1,
              level: i,
              refName: f1.get('refName'),
              layout: [f1.get('start'), 0, f1.get('end'), 10] as RectTuple,
            },
            {
              feature: f2,
              level: j,
              refName: f2.get('refName'),
              layout: [f2.get('start'), 0, f2.get('end'), 10] as RectTuple,
            },
          ])
        }
      }
    }
  }
  return matches
}

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
function LinearSyntenyRendering(props: {
  width: number
  height: number
  trackModel: LinearSyntenyTrackModel
  highResolutionScaling: number
  features: SimpleFeatureSerialized[][]
  trackIds: string[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const {
    height,
    width,
    trackModel = {},
    highResolutionScaling = 1,
    features,
    trackIds,
  } = props
  const deserializedFeatures = useMemo(
    () =>
      features.map(level => {
        return level
          .map(f => new SimpleFeature(f))
          .sort((a, b) => a.get('syntenyId') - b.get('syntenyId'))
      }),
    [features],
  )

  const parentView = getContainingView(trackModel) as LinearSyntenyViewModel
  const { views } = parentView
  const matches = layoutMatches(deserializedFeatures)
  const offsets = views.map(view => view.offsetPx)

  const fill = getConf(trackModel, ['renderer', 'color'])
  const stroke = getConf(trackModel, ['renderer', 'color'])
  const showIntraviewLinks = false
  const middle = true
  const hideTiny = false
  const rects = []
  matches.forEach(m => {
    // we follow a path in the list of chunks, not from top to bottom, just in series
    // following x1,y1 -> x2,y2
    for (let i = 0; i < m.length - 1; i += 1) {
      const { layout: c1, feature: f1, level: l1, refName: ref1 } = m[i]
      const { layout: c2, feature: f2, level: l2, refName: ref2 } = m[i + 1]
      const v1 = views[l1]
      const v2 = views[l2]

      if (!c1 || !c2) {
        console.warn('received null layout for a overlay feature')
        return
      }

      // disable rendering connections in a single level
      if (!showIntraviewLinks && l1 === l2) {
        continue
      }
      const length1 = f1.get('end') - f1.get('start')
      const length2 = f2.get('end') - f2.get('start')

      if ((length1 < v1.bpPerPx || length2 < v2.bpPerPx) && hideTiny) {
        continue
      }

      const x11 = px(v1, { refName: ref1, coord: c1[LEFT] }) - offsets[l1]
      const x12 = px(v1, { refName: ref1, coord: c1[RIGHT] }) - offsets[l1]
      const x21 = px(v2, { refName: ref2, coord: c2[LEFT] }) - offsets[l2]
      const x22 = px(v2, { refName: ref2, coord: c2[RIGHT] }) - offsets[l2]

      const y1 = middle
        ? interstitialYPos(l1 < l2, height)
        : // prettier-ignore
          // @ts-ignore
          overlayYPos(trackIds[0], l1, views, c1, l1 < l2)
      const y2 = middle
        ? interstitialYPos(l2 < l1, height)
        : // prettier-ignore
          // @ts-ignore
          overlayYPos(trackIds[1], l2, views, c2, l2 < l1)

      // drawing a line if the results are thin results in much less pixellation than
      // filling in a thin polygon
      if (length1 < v1.bpPerPx || length2 < v2.bpPerPx) {
        const path = Path().moveto(x11, y1).lineto(x21, y2)
        rects.push(<Shape d={path.print()} stroke={stroke} />)
      } else {
        const path = Path()
          .moveto(x11, y1)
          .lineto(x12, y1)
          .lineto(x22, y2)
          .lineto(x21, y2)
          .closepath()
        rects.push(<Shape d={path.print()} fill={fill} />)
      }
    }
  })
  // })

  return (
    <Surface width={width} height={height}>
      {rects}
    </Surface>
  )
}

export default observer(LinearSyntenyRendering)
