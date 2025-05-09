import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'

import type { RenderArgsDeserialized } from './types'

export default class LinearVariantMatrixRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, sources, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const { end, start } = region

    const width = (end - start) / bpPerPx
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
      features: new Map(),
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
    }
  }
}

export type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsDeserialized,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
