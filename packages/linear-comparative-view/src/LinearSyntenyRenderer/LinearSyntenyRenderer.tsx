/* eslint-disable  no-nested-ternary */
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import ComparativeRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { bpSpanPx, iterMap } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { LinearSyntenyTrackModel } from '../LinearSyntenyTrack'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

interface LinearSyntenyRenderProps {
  features: Map<string, Feature>
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
  views: {
    bpPerPx: number
    offsetPx: number
    displayRegions: IRegion[]
    headerHeight: number
    scaleBarHeight: number
    tracks: {
      scrollTop: number
      height: number
      trackId: string
    }
  }
}

interface LinearSyntenyImageData {
  imageData?: ImageBitmap
  height: number
  width: number
  maxHeightReached: boolean
}
interface LayoutRecord {
  feature: Feature
  leftPx: number
  rightPx: number
  topPx: number
  heightPx: number
}

export default class LinearSyntenyRenderer extends ComparativeRendererType {
  private ReactComponent: any

  constructor(stuff: any) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
  }

  async makeImageData(props: LinearSyntenyRenderProps) {
    const { highResolutionScaling = 1, views } = props

    const width = 0
    const height = 0
    // if (!(width > 0) || !(height > 0))
    //   return { height: 0, width: 0, maxHeightReached: false }

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    // const ctx = canvas.getContext('2d')
    // ctx.scale(highResolutionScaling, highResolutionScaling)
    // ctx.font = 'bold 10px Courier New,monospace'

    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height: 0,
      width: 0,
    }
  }

  async render(renderProps: LinearSyntenyRenderProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return {
      element,
      imageData,
      height,
      width,
    }
  }
}

const func = observer((model: any, track: any) => {
  const { views } = model
  const { subtracks, subtrackViews } = track

  const showIntraviewLinks = false
  const middle = false
  const hideTiny = false
  const arr = [] as any[]

  return (
    <g stroke="#333" fill="none">
      {arr.map(chunk => {
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

          const y1 = middle
            ? level1 < level2
              ? 0
              : 150
            : yPos(track.trackIds[0], level1, subtrackViews, subtracks, c1) +
              (level1 < level2 ? cheight(c1) : 0)
          const y2 = middle
            ? level2 < level1
              ? 0
              : 150
            : yPos(track.trackIds[1], level2, subtrackViews, subtracks, c2) +
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
})
