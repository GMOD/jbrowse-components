import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { bpSpanPx, iterMap } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { Mismatch } from '../BamAdapter/BamSlightlyLazyFeature'
import { sortFeature } from './sortUtil'

interface PileupRenderProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
  sortObject: {
    position: number
    by: string
  }
}

interface PileupImageData {
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

export default class extends BoxRendererType {
  layoutFeature(
    feature: Feature,
    subLayout: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    bpPerPx: number,
    region: IRegion,
    horizontallyFlipped = false,
  ): LayoutRecord | null {
    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )

    let heightPx = readConfObject(config, 'height', [feature])
    const displayMode = readConfObject(config, 'displayMode', [feature])
    if (displayMode === 'compact') heightPx /= 3
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
      leftPx,
      rightPx,
      topPx: displayMode === 'collapse' ? 0 : topPx,
      heightPx,
    }
  }

  // TODOSORT: write sorting inside here and util, props should contain a sort by this time
  // look at logic related to filter to see if any special logic is necessary
  async makeImageData(props: PileupRenderProps) {
    const {
      features,
      layout,
      config,
      region,
      bpPerPx,
      horizontallyFlipped,
      sortObject,
      highResolutionScaling = 1,
    } = props

    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) throw new Error('invalid layout object')
    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const w = Math.max(minFeatWidth, pxPerBp)

    // TODOSORT: this is where the layout is generated, feature needs to be sorted before here
    // might be interblock dependencies watch out for them
    const sortedFeatures = sortFeature(
      features,
      sortObject,
      bpPerPx,
      region,
      horizontallyFlipped,
    )
    const featureMap = sortObject.by !== '' ? sortedFeatures : features
    const layoutRecords = iterMap(
      featureMap.values(),
      feature =>
        this.layoutFeature(
          feature,
          layout,
          config,
          bpPerPx,
          region,
          horizontallyFlipped,
        ),
      featureMap.size,
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
      const { feature, leftPx, rightPx, topPx, heightPx } = feat
      ctx.fillStyle = readConfObject(config, 'color', [feature])
      ctx.fillRect(leftPx, topPx, Math.max(rightPx - leftPx, 1.5), heightPx)
      // TODOSORT: use Mismatch in util function
      //       Array.from(features)
      // [...features] transform map -> array then sort the array base on criteria
      // then turn back into map and pass back into here possibly
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
          const [mismatchLeftPx, mismatchRightPx] = bpSpanPx(
            feature.get('start') + mismatch.start,
            feature.get('start') + mismatch.start + mismatch.length,
            region,
            bpPerPx,
            horizontallyFlipped,
          )
          const mismatchWidthPx = Math.max(
            minFeatWidth,
            Math.abs(mismatchLeftPx - mismatchRightPx),
          )

          if (mismatch.type === 'mismatch' || mismatch.type === 'deletion') {
            ctx.fillStyle =
              colorForBase[
                mismatch.type === 'deletion' ? 'deletion' : mismatch.base
              ] || '#888'
            ctx.fillRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)

            if (
              mismatchWidthPx >= charSize.width &&
              heightPx >= charSize.height - 5
            ) {
              ctx.fillStyle = mismatch.type === 'deletion' ? 'white' : 'black'
              ctx.fillText(
                mismatch.base,
                mismatchLeftPx + (mismatchWidthPx - charSize.width) / 2 + 1,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'insertion') {
            ctx.fillStyle = 'purple'
            const pos = mismatchLeftPx - 1
            ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
            if (
              mismatchWidthPx >= charSize.width &&
              heightPx >= charSize.height - 2
            ) {
              ctx.fillText(
                `(${mismatch.base})`,
                mismatchLeftPx + 2,
                topPx + heightPx,
              )
            }
          } else if (
            mismatch.type === 'hardclip' ||
            mismatch.type === 'softclip'
          ) {
            ctx.fillStyle = mismatch.type === 'hardclip' ? 'red' : 'blue'
            const pos = mismatchLeftPx - 1
            ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
            if (
              mismatchWidthPx >= charSize.width &&
              heightPx >= charSize.height - 2
            ) {
              ctx.fillText(
                `(${mismatch.base})`,
                mismatchLeftPx + 2,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'skip') {
            ctx.clearRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)
            ctx.fillStyle = '#333'
            ctx.fillRect(
              mismatchLeftPx,
              topPx + heightPx / 2,
              mismatchWidthPx,
              2,
            )
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

  async render(renderProps: PileupRenderProps) {
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
