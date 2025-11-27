import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'

import type { RenderArgsDeserialized } from './types'
import type { Feature } from '@jbrowse/core/util'

export default class LinearVariantMatrixRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, sources, regions, bpPerPx, scrollTop, rowHeight } =
      renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { makeImageData } = await import('./makeImageData')
    const { mafs, ...rest } = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx =>
        makeImageData({
          ctx,
          canvasWidth: width,
          canvasHeight: height,
          renderArgs: {
            ...renderProps,
            features,
            sources,
          },
        }),
    )

    const results = await super.render({
      ...renderProps,
      ...rest,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...rest,
      features: new Map<string, Feature>(),
      simplifiedFeatures: mafs.map(
        ({ feature }) =>
          new SimpleFeature({
            id: feature.id(),
            data: {
              start: feature.get('start'),
              end: feature.get('end'),
              refName: feature.get('refName'),
            },
          }),
      ),
      height,
      width,
      origScrollTop: scrollTop,
      rowHeight,
    }
  }
}
