import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { bpToPx, iterMap } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React, { ComponentElement } from 'react'
import { Mismatch } from '../BamAdapter/BamSlightlyLazyFeature'

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
}

interface PileupImageData {
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

export default class extends BoxRendererType {
  layoutFeature(
    feature: Feature,
    subLayout: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    bpPerPx: number,
    region: IRegion,
    horizontallyFlipped: boolean = false,
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

  async makeImageData(props: PileupRenderProps): Promise<PileupImageData> {
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

    let layoutRecords

    const getFeatureLayout = (): (LayoutRecord | null)[] =>
      iterMap(
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
    try {
      layoutRecords = getFeatureLayout()
    } catch (e) {
      layout.reinitialize()
      layoutRecords = getFeatureLayout()
    }

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
    let maxHeightReached = false

    layoutRecords.forEach(feat => {
      if (feat === null) {
        maxHeightReached = true
        return
      }
      const { feature, startPx, endPx, topPx, heightPx } = feat
      ctx.fillStyle = readConfObject(config, 'alignmentColor', [feature])
      ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
      const mismatches: Mismatch[] = feature.get('mismatches')
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
          const leftPx = getCoord(start)
          const widthPx = getCoord(end) - leftPx

          if (mismatch.type === 'mismatch' || mismatch.type === 'deletion') {
            ctx.fillStyle =
              colorForBase[
                mismatch.type === 'deletion' ? 'deletion' : mismatch.base
              ]
            ctx.fillRect(leftPx, topPx, widthPx, heightPx)

            if (widthPx >= charSize.width && heightPx >= charSize.height - 2) {
              ctx.fillStyle = mismatch.type === 'deletion' ? 'white' : 'black'
              ctx.fillText(
                mismatch.base,
                leftPx + (widthPx - charSize.width) / 2 + 1,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'insertion') {
            ctx.fillStyle = 'purple'
            ctx.fillRect(leftPx - 1, topPx + 1, 2, heightPx - 2)
            ctx.fillRect(leftPx - 2, topPx, 4, 1)
            ctx.fillRect(leftPx - 2, topPx + heightPx - 1, 4, 1)
            if (widthPx >= charSize.width && heightPx >= charSize.height - 2) {
              ctx.fillText(`(${mismatch.base})`, leftPx + 2, topPx + heightPx)
            }
          } else if (
            mismatch.type === 'hardclip' ||
            mismatch.type === 'softclip'
          ) {
            ctx.fillStyle = mismatch.type === 'hardclip' ? 'red' : 'blue'
            ctx.fillRect(leftPx - 1, topPx + 1, 2, heightPx - 2)
            ctx.fillRect(leftPx - 2, topPx, 4, 1)
            ctx.fillRect(leftPx - 2, topPx + heightPx - 1, 4, 1)
            if (widthPx >= charSize.width && heightPx >= charSize.height - 2) {
              ctx.fillText(`(${mismatch.base})`, leftPx + 2, topPx + heightPx)
            }
          } else if (mismatch.type === 'skip') {
            ctx.clearRect(leftPx, topPx, widthPx, heightPx)
            ctx.fillStyle = '#333'
            ctx.fillRect(leftPx, topPx + heightPx / 2, widthPx, 2)
          }
        }
      }
    })

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width, maxHeightReached }
  }

  async render(
    renderProps: PileupRenderProps,
  ): Promise<{
    element: ComponentElement<PileupRenderProps & PileupImageData, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    imageData?: ImageBitmap
    height: number
    width: number
    maxHeightReached: boolean
  }> {
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
    // @ts-ignore seems to think imageData is optional in some context?
    return { element, imageData, height, width, maxHeightReached }
  }
}
