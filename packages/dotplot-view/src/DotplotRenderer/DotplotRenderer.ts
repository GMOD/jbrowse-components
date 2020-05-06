/* eslint-disable  @typescript-eslint/no-explicit-any */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import Base1DView, {
  Base1DViewModel,
} from '@gmod/jbrowse-core/util/Base1DViewModel'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { tap, filter, distinct, toArray } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

interface Block extends IRegion {
  offsetPx: number
  widthPx: number
}

export interface DotplotRenderProps {
  dataAdapter: BaseFeatureDataAdapter
  signal?: AbortSignal
  config: any
  height: number
  width: number
  fontSize: number
  highResolutionScaling: number
  pluginManager: PluginManager
  views: Base1DViewModel[]
}

export default class DotplotRenderer extends ComparativeServerSideRendererType {
  async makeImageData(props: DotplotRenderProps) {
    const {
      highResolutionScaling: scale = 1,
      width,
      height,
      config,
      views,
    } = props

    const canvas = createCanvas(Math.ceil(width * scale), height * scale)
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    ctx.fillStyle = 'black'

    ctx.lineWidth = 3
    ctx.fillStyle = readConfObject(config, 'color')
    const db1 = views[0].dynamicBlocks.contentBlocks
    const db2 = views[1].dynamicBlocks.contentBlocks
    // @ts-ignore
    views[0].features.forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      // const identity = feature.get('numMatches') / feature.get('blockLen')
      // ctx.fillStyle = `hsl(${identity * 150},50%,50%)`
      ctx.fillStyle = 'black'
      // @ts-ignore
      const b1 = views[0].bpToPx(refName, start) - db1[0].offsetPx
      // @ts-ignore
      const b2 = views[0].bpToPx(refName, end) - db1[0].offsetPx
      // @ts-ignore
      const e1 = views[1].bpToPx(mate.refName, mate.start) - db2[0].offsetPx
      // @ts-ignore
      const e2 = views[1].bpToPx(mate.refName, mate.end) - db2[0].offsetPx
      if (b1 && b2 && e1 && e2) {
        if (b1 - b2 < 3 && e1 - e2 < 3) {
          ctx.fillRect(b1 - 1, height - e1 - 1, 3, 3)
        } else {
          let currX = b1
          let currY = e1
          let cigar = feature.get('cg')
          if (cigar) {
            cigar = (cigar.toUpperCase().match(/\d+\D/g) || [])
              .map((op: string) => {
                // @ts-ignore
                return [op.match(/\D/)[0], parseInt(op, 10)]
              })
              .forEach(([op, val]: [string, number]) => {
                const prevX = currX
                const prevY = currY

                if (op === 'M') {
                  currX += val / views[0].bpPerPx - 0.01
                  currY += val / views[1].bpPerPx - 0.01
                } else if (op === 'D') {
                  currX += val / views[0].bpPerPx
                } else if (op === 'I') {
                  currY += val / views[1].bpPerPx
                }
                ctx.beginPath()
                ctx.moveTo(prevX, height - prevY)
                ctx.lineTo(currX, height - currY)
                ctx.stroke()
              })
          } else {
            ctx.beginPath()
            ctx.moveTo(b1, height - e1)
            ctx.lineTo(b2, height - e2)
            ctx.stroke()
          }
        }
      }
    })
    return createImageBitmap(canvas)
  }

  async render(renderProps: DotplotRenderProps) {
    const { width, height, views } = renderProps
    const dimensions = [width, height]
    const realizedViews = views.map((view, idx) =>
      Base1DView.create({ ...view, width: dimensions[idx] }),
    )
    await Promise.all(
      realizedViews.map(async view => {
        view.setFeatures(
          await this.getFeatures({
            ...renderProps,
            regions: view.dynamicBlocks.contentBlocks,
          }),
        )
      }),
    )
    const imageData = await this.makeImageData({
      ...renderProps,
      views: realizedViews,
    })

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
      offsetX: realizedViews[0].dynamicBlocks.blocks[0].offsetPx,
      offsetY: realizedViews[1].dynamicBlocks.blocks[0].offsetPx,
    }
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param {object} renderArgs
   * @returns {Map} of features as { id => feature, ... }
   */
  async getFeatures(renderArgs: DotplotRenderProps & { regions: IRegion[] }) {
    const { dataAdapter, signal } = renderArgs

    let regions = [] as IRegion[]

    // @ts-ignore this is instantiated by the getFeatures call
    regions = renderArgs.regions

    if (!regions || regions.length === 0) {
      console.warn('no regions supplied to comparative renderer')
      return []
    }

    const requestRegions = regions.map((r: IRegion) => {
      // make sure the requested region's start and end are integers, if
      // there is a region specification.
      const requestRegion = { ...r }
      if (requestRegion.start) {
        requestRegion.start = Math.floor(requestRegion.start)
      }
      if (requestRegion.end) {
        requestRegion.end = Math.floor(requestRegion.end)
      }
      return requestRegion
    })

    // note that getFeaturesInMultipleRegions does not do glyph expansion
    const featureObservable = dataAdapter.getFeaturesInMultipleRegions(
      requestRegions,
      {
        signal,
      },
    )

    return featureObservable
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        distinct(feature => feature.id()),
        toArray(),
      )
      .toPromise()
  }
}
