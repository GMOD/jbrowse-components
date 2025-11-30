import { BoxRendererType } from '@jbrowse/core/pluggableElementTypes'
import { rpcResult } from 'librpc-web-mod'

import { doAll } from './doAll'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

export default class CanvasFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = Math.max(1, (region.end - region.start) / bpPerPx)

    // Render to canvas
    const res = await doAll({
      pluginManager: this.pluginManager,
      renderProps,
      layout,
      features,
    })

    const height = Math.max(1, layout.getTotalHeight())

    const result = await super.render({
      ...renderProps,
      ...res,
      features,
      layout,
      height,
      width,
    })

    const serialized = {
      ...result,
      ...res,
      features: new Map(),
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }

    if (res.imageData instanceof ImageBitmap) {
      return rpcResult(serialized, [res.imageData])
    }
    return serialized
  }
}
