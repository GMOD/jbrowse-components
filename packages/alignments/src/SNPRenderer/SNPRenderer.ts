import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { bpToPx, iterMap } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { Mismatch } from '../SNPAdapter/SNPSlightlyLazyFeature'

// most likely need to change whats included
interface SNPRenderProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
}

// also here
interface SNPImageData {
  imageData?: ImageBitmap
  height: number
  width: number
  maxHeightReached: boolean
}
interface LayoutRecord {
  feature: Feature
  startPx: number
  endPx: number
  topPx: number
  heightPx: number
}

// will be changing to an XYPlot renderer, may not need it's own
export default class extends BoxRendererType {
  layoutFeature(
    feature: Feature,
    subLayout: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    bpPerPx: number,
    region: IRegion,
    horizontallyFlipped = false,
  ): LayoutRecord | null {
    const startPx = bpToPx(
      feature.get('start'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )
    const endPx = bpToPx(
      feature.get('end'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )

    const heightPx = readConfObject(config, 'alignmentHeight', [feature])
    if (feature.get('refName') !== region.refName) {
      throw new Error(
        `feature ${feature.id()} is not on the current region's reference sequence ${
          region.refName
        }`,
      )
    }
    const topPx = subLayout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('end'),
      heightPx,
      feature,
    )
    if (topPx === null) {
      return null
    }

    return {
      feature,
      startPx,
      endPx,
      topPx,
      heightPx,
    }
  }

  async makeImageData(props: SNPRenderProps) {
    const {
      features,
      layout,
      config,
      region,
      bpPerPx,
      horizontallyFlipped,
      highResolutionScaling = 1,
    } = props
    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) throw new Error('invalid layout object')
    const getCoord = (coord: number): number =>
      bpToPx(coord, region, bpPerPx, horizontallyFlipped)
    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const w = Math.max(minFeatWidth, pxPerBp)

    const layoutRecords = iterMap(
      features.values(),
      feature =>
        this.layoutFeature(
          feature,
          layout,
          config,
          bpPerPx,
          region,
          horizontallyFlipped,
        ),
      features.size,
    )

    const width = (region.end - region.start) / bpPerPx
    const height = layout.getTotalHeight()
    if (!(width > 0) || !(height > 0))
      return { height: 0, width: 0, maxHeightReached: false }

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    ctx.font = 'bold 10px Courier New,monospace'
    const charSize = ctx.measureText('A')
    charSize.height = 7

    layoutRecords.forEach(feat => {
      if (feat === null) {
        return
      }
      const { feature, startPx, endPx, topPx, heightPx } = feat
      ctx.fillStyle = readConfObject(config, 'alignmentColor', [feature])
      ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
      const mismatches: Mismatch[] =
        bpPerPx < 10 ? feature.get('mismatches') : feature.get('skips_and_dels')
      if (mismatches) {
        const colorForBase: { [key: string]: string } = {
          A: '#00bf00',
          C: '#4747ff',
          G: '#ffa500',
          T: '#f00',
          deletion: 'grey',
        }
        for (let i = 0; i < mismatches.length; i += 1) {
          const mismatch = mismatches[i]
          const start = feature.get('start') + mismatch.start
          const end = start + mismatch.length
          const mismatchStartPx = getCoord(start)
          const mismatchEndPx = getCoord(end)
          const widthPx = Math.max(
            minFeatWidth,
            Math.abs(mismatchStartPx - mismatchEndPx),
          )

          if (mismatch.type === 'mismatch' || mismatch.type === 'deletion') {
            ctx.fillStyle =
              colorForBase[
                mismatch.type === 'deletion' ? 'deletion' : mismatch.base
              ] || '#888'
            ctx.fillRect(mismatchStartPx, topPx, widthPx, heightPx)

            if (widthPx >= charSize.width && heightPx >= charSize.height - 2) {
              ctx.fillStyle = mismatch.type === 'deletion' ? 'white' : 'black'
              ctx.fillText(
                mismatch.base,
                mismatchStartPx + (widthPx - charSize.width) / 2 + 1,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'insertion') {
            ctx.fillStyle = 'purple'
            const pos = mismatchStartPx - 1
            ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
            if (widthPx >= charSize.width && heightPx >= charSize.height - 2) {
              ctx.fillText(
                `(${mismatch.base})`,
                mismatchStartPx + 2,
                topPx + heightPx,
              )
            }
          } else if (
            mismatch.type === 'hardclip' ||
            mismatch.type === 'softclip'
          ) {
            ctx.fillStyle = mismatch.type === 'hardclip' ? 'red' : 'blue'
            const pos = mismatchStartPx - 1
            ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
            if (widthPx >= charSize.width && heightPx >= charSize.height - 2) {
              ctx.fillText(
                `(${mismatch.base})`,
                mismatchStartPx + 2,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'skip') {
            ctx.clearRect(mismatchStartPx, topPx, widthPx, heightPx)
            ctx.fillStyle = '#333'
            ctx.fillRect(mismatchStartPx, topPx + heightPx / 2, widthPx, 2)
          }
        }
      }
    })

    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }
  }

  async render(renderProps: SNPRenderProps) {
    const {
      height,
      width,
      imageData,
      maxHeightReached,
    } = await this.makeImageData(renderProps)
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
      maxHeightReached,
      layout: renderProps.layout,
    }
  }
}
