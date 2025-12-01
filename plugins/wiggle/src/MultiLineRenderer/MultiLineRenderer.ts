import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import {
  forEachWithStopTokenCheck,
  groupBy,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from 'librpc-web-mod'

import type { MultiRenderArgsDeserialized } from '../types'
import type { Feature } from '@jbrowse/core/util'

export default class MultiLineRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: MultiRenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      sources,
      height,
      regions,
      bpPerPx,
      stopToken,
      statusCallback = () => {},
    } = renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { reducedFeatures, ...rest } = await updateStatus(
      'Rendering plot',
      statusCallback,
      async () => {
        const { drawLine } = await import('../drawLine')
        return renderToAbstractCanvas(width, height, renderProps, ctx => {
          const groups = groupBy(features.values(), f => f.get('source'))
          let feats: Feature[] = []
          forEachWithStopTokenCheck(sources, stopToken, source => {
            const { reducedFeatures } = drawLine(ctx, {
              ...renderProps,
              features: groups[source.name] || [],
              colorCallback: () => source.color || 'blue',
            })
            feats = feats.concat(reducedFeatures)
          })
          return { reducedFeatures: feats }
        })
      },
    )

    const serialized = {
      ...rest,
      features: reducedFeatures?.map(f => f.toJSON()),
      height,
      width,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
