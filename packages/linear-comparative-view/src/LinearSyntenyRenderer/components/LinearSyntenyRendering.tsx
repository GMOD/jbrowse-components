import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { Base1DViewModel } from '@gmod/jbrowse-core/util/Base1DViewModel'
import { getPxFromCoordinate, interstitialYPos, overlayYPos } from '../../util'

;/nearsyntenyrendering* eslint-disable no-plusplus,no-continue */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const [LEFT, TOP, RIGHT, BOTTOM] = [0, 1, 2, 3]
export type LayoutTuple = [number, number, number, number]
interface LayoutMatch {
  level: number
  layout: LayoutTuple
  feature: Feature
  refName: string
}

function* generateMatches(l1: Feature[] = [], l2: Feature[] = []) {
  let i = 0
  let j = 0
  while (i < l1.length && j < l2.length) {
    const a = l1[i].get('syntenyId')
    const b = l2[j].get('syntenyId')
    if (a < b) {
      i++
    } else if (b < a) {
      j++
    } else {
      yield [l1[i], l2[j]]
      i++
      j++
    }
  }
}

function layoutMatchesFromViews(views: Base1DViewModel[]) {
  const layoutMatches = []
  for (let i = 0; i < views.length; i++) {
    for (let j = i; j < views.length; j++) {
      if (i !== j) {
        // NOTE: we might need intra-view "synteny" e.g. ortholog?
        // similar to breakpoint squiggles in a single LGV, so may not want
        // the check for i != j
        for (const match of generateMatches(
          views[i].features,
          views[j].features,
        )) {
          const [l1, l2] = match
          layoutMatches.push([
            {
              feature: l1,
              level: i,
              refName: l1.get('refName'),
              layout: [l1.get('start'), 0, l1.get('end'), 10] as LayoutTuple,
            },
            {
              feature: l2,
              level: j,
              refName: l2.get('refName'),
              layout: [l2.get('start'), 0, l2.get('end'), 10] as LayoutTuple,
            },
          ])
        }
      }
    }
  }
  return layoutMatches
}

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
function LinearSyntenyRendering(props: {
  width: number
  height: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackModel: any
  highResolutionScaling: number
  views: Base1DViewModel[]
  trackIds: string[]
}) {
  console.log(props)
  const {
    height,
    trackModel = {},
    highResolutionScaling = 1,
    views,
    trackIds,
  } = props
  const ref = useRef<HTMLCanvasElement>(null)

  views.forEach(view => {
    if (view.features) {
      view.features.sort((a, b) => a.get('syntenyId') - b.get('syntenyId'))
    }
  })
  const layoutMatches = layoutMatchesFromViews(views)

  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d')
    if (!ctx) return
    ctx.scale(highResolutionScaling, highResolutionScaling)
    ctx.fillStyle = getConf(trackModel, 'color')
    const showIntraviewLinks = false
    const middle = true
    const hideTiny = false
    layoutMatches.forEach(chunk => {
      // we follow a path in the list of chunks, not from top to bottom, just in series
      // following x1,y1 -> x2,y2
      for (let i = 0; i < chunk.length - 1; i += 1) {
        const { layout: c1, feature: f1, level: level1, refName: ref1 } = chunk[
          i
        ]
        const { layout: c2, feature: f2, level: level2, refName: ref2 } = chunk[
          i + 1
        ]
        const v1 = views[level1]
        const v2 = views[level2]

        if (!c1 || !c2) {
          console.warn('received null layout for a overlay feature')
          return
        }

        // disable rendering connections in a single level
        if (!showIntraviewLinks && level1 === level2) {
          return
        }
        const length1 = f1.get('end') - f1.get('start')
        const length2 = f2.get('end') - f2.get('start')

        if (length1 < v1.bpPerPx || length2 < v2.bpPerPx) {
          if (hideTiny) {
            continue
          }
        }
        // if (
        //   !v1.staticBlocks.find(region => region.refName === ref1) ||
        //   !v2.staticBlocks.find(region => region.refName === ref2)
        // ) {
        //   continue
        // }

        // @ts-ignore
        const x11 = getPxFromCoordinate(v1, ref1, c1[LEFT])
        // @ts-ignore
        const x12 = getPxFromCoordinate(v1, ref1, c1[RIGHT])
        // @ts-ignore
        const x21 = getPxFromCoordinate(v2, ref2, c2[LEFT])
        // @ts-ignore
        const x22 = getPxFromCoordinate(v2, ref2, c2[RIGHT])

        const y1 = middle
          ? interstitialYPos(level1 < level2, height)
          : // prettier-ignore
            // @ts-ignore
            overlayYPos(trackIds[0], level1, views, c1, level1 < level2)
        const y2 = middle
          ? interstitialYPos(level2 < level1, height)
          : // prettier-ignore
            // @ts-ignore
            overlayYPos(trackIds[1], level2, views, c2, level2 < level1)

        ctx.beginPath()
        ctx.moveTo(x11, y1)
        ctx.lineTo(x12, y1)
        ctx.lineTo(x22, y2)
        ctx.lineTo(x21, y2)
        ctx.closePath()
        ctx.fill()
      }
    })
  })
  return (
    <canvas
      ref={ref}
      data-testid="prerendered_canvas"
      width={800}
      height={200}
    />
  )
}

export default observer(LinearSyntenyRendering)
