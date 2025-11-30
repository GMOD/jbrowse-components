import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { PileupLayoutSession } from './PileupLayoutSession'
import { fetchSequence } from '../util'
import { layoutFeats } from './layoutFeatures'

import type { PileupLayoutSessionProps } from './PileupLayoutSession'
import type { RenderArgsDeserialized } from './types'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export default class PileupRenderer extends BoxRendererType {
  supportsSVG = true

  async fetchSequence(renderProps: RenderArgsDeserialized, region: Region) {
    const { sessionId, adapterConfig } = renderProps
    const { sequenceAdapter } = adapterConfig
    if (!sequenceAdapter) {
      return undefined
    }
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      sequenceAdapter,
    )
    return fetchSequence(
      {
        ...region,
        start: Math.max(0, region.start - 1),
        end: region.end + 1,
      },
      dataAdapter as BaseFeatureDataAdapter,
    )
  }

  getExpandedRegion(region: Region, renderArgs: RenderArgsDeserialized) {
    const { config, showSoftClip } = renderArgs
    const { start, end } = region
    const maxClippingSize = readConfObject(config, 'maxClippingSize')
    const bpExpansion = showSoftClip ? Math.round(maxClippingSize) : 0

    return {
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
      ...(region as Omit<typeof region, symbol>),
      start: Math.floor(Math.max(start - bpExpansion, 0)),
      end: Math.ceil(end + bpExpansion),
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { statusCallback = () => {}, colorBy, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx
    const { layoutRecords, height } = await updateStatus(
      'Creating layout',
      statusCallback,
      () =>
        layoutFeats({
          ...renderProps,
          features,
          layout,
        }),
    )

    const res = await updateStatus(
      'Rendering alignments',
      statusCallback,
      async () => {
        const regionSequence =
          colorBy?.type === 'methylation' && features.size
            ? await this.fetchSequence(renderProps, region)
            : undefined
        const { makeImageData } = await import('./makeImageData')

        return renderToAbstractCanvas(width, height, renderProps, ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            canvasWidth: width,
            renderArgs: {
              ...renderProps,
              layout,
              features,
              regionSequence,
            },
          }),
        )
      },
    )

    const results = await super.render({
      ...renderProps,
      ...res,
      features,
      layout,
      height,
      width,
    })

    return {
      ...results,
      ...res,
      features: new Map(),
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }
  }

  createLayoutSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}
