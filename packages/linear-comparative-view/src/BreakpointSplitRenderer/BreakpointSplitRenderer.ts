/* eslint-disable  no-continue */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import {
  overlayYPos,
  interstitialYPos,
  getPxFromCoordinate,
  ReducedLinearGenomeViewModel,
} from '../util'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

interface LayoutMatch {
  level: number
  layout: LayoutTuple
  feature: Feature
  refName: string
}
interface BreakpointSplitRenderProps {
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
  trackIds: string[]
  views: ReducedLinearGenomeViewModel[]
}

interface BreakpointSplitRenderingProps extends BreakpointSplitRenderProps {
  imageData: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface BreakpointSplitImageData {
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

export type LayoutTuple = [number, number, number, number]

const strcmp = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
}).compare

function* generateLayoutMatches(views: ReducedLinearGenomeViewModel[]) {
  const feats = views
    .map((view, index) =>
      view.features.map(feature => ({
        feature,
        level: index,
        refName: feature.get('refName'),
        layout: [feature.get('start'), 0, feature.get('end'), 0] as LayoutTuple,
      })),
    )
    .flat()
    .sort((a, b) => strcmp(a.feature.get('name'), b.feature.get('name')))

  let currEmit = [feats[0]]
  let currFeat: { feature: Feature; level: number } = feats[0]

  for (let i = 1; i < feats.length; i++) {
    if (currFeat.feature.get('name') !== feats[i].feature.get('name')) {
      yield currEmit
      currFeat = feats[i]
      currEmit = [feats[i]]
    } else {
      currEmit.push(feats[i])
    }
  }
}

function drawArrow(
  context: CanvasRenderingContext2D,
  fromx: number,
  fromy: number,
  tox: number,
  toy: number,
) {
  const headlen = 6 // length of head in pixels
  const dx = tox - fromx
  const dy = toy - fromy
  const angle = Math.atan2(dy, dx)
  context.fillStyle = 'black'
  context.beginPath()
  context.moveTo(tox, toy)
  context.lineTo(
    tox - headlen * Math.cos(angle - Math.PI / 8),
    toy - headlen * Math.sin(angle - Math.PI / 6),
  )
  context.lineTo(
    tox - headlen * Math.cos(angle + Math.PI / 8),
    toy - headlen * Math.sin(angle + Math.PI / 8),
  )
  context.closePath()
  context.fill()
}

export default class BreakpointSplitRenderer extends ComparativeServerSideRendererType {
  async makeImageData(props: BreakpointSplitRenderProps) {
    const {
      highResolutionScaling: scale = 1,
      width,
      height,
      views,
      trackIds,
      config,
    } = props

    const canvas = createCanvas(Math.ceil(width * scale), height * scale)
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.fillStyle = readConfObject(config, 'color')
    const showIntraviewLinks = false
    const middle = true

    for (const chunk of generateLayoutMatches(views)) {
      // we follow a path in the list of chunks, not from top to bottom, just in series
      // following x1,y1 -> x2,y2
      chunk.sort((a, b) => a.feature.get('clipPos') - b.feature.get('clipPos'))
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
          continue
        }

        // possible TODO
        // restore refName mapping for alternative refNames

        // disable rendering connections in a single level
        if (!showIntraviewLinks && level1 === level2) {
          continue
        }

        // flipMultiplier combines with normal directionality of the curve
        const flipMultipliers = views.map(v => (v.horizontallyFlipped ? -1 : 1))

        const x1 = getPxFromCoordinate(
          v1,
          ref1,
          c1[f1.get('strand') === -1 ? LEFT : RIGHT],
        )
        const x2 = getPxFromCoordinate(
          v2,
          ref2,
          c2[f2.get('strand') === -1 ? RIGHT : LEFT],
        )

        // const tracks = views.map(v => v.getTrack(trackConfigId))

        const y1 = middle
          ? interstitialYPos(level1 < level2, height)
          : overlayYPos(trackIds[0], level1, views, c1, level1 < level2)
        const y2 = middle
          ? interstitialYPos(level2 < level1, height)
          : overlayYPos(trackIds[1], level2, views, c2, level2 < level1)

        // possible todo: use totalCurveHeight to possibly make alternative squiggle if the S is too small

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.bezierCurveTo(
          x1 + 200 * f1.get('strand') * flipMultipliers[level1],
          y1,
          x2 - 200 * f2.get('strand') * flipMultipliers[level2],
          y2,
          x2,
          y2,
        )
        ctx.stroke()
        drawArrow(
          ctx,
          x2 - 10 * f2.get('strand') * flipMultipliers[level2],
          y2,
          x2,
          y2,
        )
      }
    }

    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height,
      width,
    }
  }

  async render(renderProps: BreakpointSplitRenderProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)

    const element = React.createElement(
      // @ts-ignore
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
