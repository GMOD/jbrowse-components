import { readConfObject } from '@jbrowse/core/configuration'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { expandRegion } from '@jbrowse/core/pluggableElementTypes/renderers/util'
import { updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import { PileupLayoutSession } from './PileupLayoutSession'

import type { PileupLayoutSessionProps } from './PileupLayoutSession'
import type { RenderArgsDeserialized } from './types'
import type { Region } from '@jbrowse/core/util'

export default class PileupRenderer extends BoxRendererType {
  supportsSVG = true

  getExpandedRegion(region: Region, renderArgs: RenderArgsDeserialized) {
    const { config, showSoftClip } = renderArgs
    const maxClippingSize = readConfObject(config, 'maxClippingSize')
    const bpExpansion = showSoftClip ? Math.round(maxClippingSize) : 0
    return expandRegion(region, bpExpansion)
  }

  async render(renderProps: RenderArgsDeserialized) {
    const { statusCallback = () => {}, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const features = await this.getFeatures(renderProps)
    const { layout, layoutWasReset } = this.createLayoutInWorker(renderProps)

    const { makeImageData } = await import('./makeImageData')
    const { result, height, featureNames } = await updateStatus(
      'Rendering alignments',
      statusCallback,
      () =>
        makeImageData({
          width,
          renderArgs: {
            ...renderProps,
            layout,
            features,
          },
          pluginManager: this.pluginManager,
        }),
    )

    const serializedLayout = this.serializeLayout(layout, renderProps)

    return rpcResult(
      {
        ...result,
        featureNames,
        layout: serializedLayout,
        height,
        width,
        maxHeightReached: layout.maxHeightReached,
        layoutWasReset,
      },
      collectTransferables(result),
    )
  }

  createLayoutSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}
