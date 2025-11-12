import { readConfObject } from '@jbrowse/core/configuration'
import { BoxRendererType } from '@jbrowse/core/pluggableElementTypes'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { computeLayouts } from './makeImageData'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

export default class CanvasFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    // Compute layouts for all features
    const layoutRecords = await updateStatus(
      'Computing feature layout',
      statusCallback as (arg: string) => void,
      () => {
        return computeLayouts({
          features,
          bpPerPx,
          region,
          config,
          layout,
        })
      },
    )

    const height = layout.getTotalHeight()

    // Render to canvas
    const res = await updateStatus(
      'Rendering features',
      statusCallback as (arg: string) => void,
      async () => {
        const { makeImageData } = await import('./makeImageData')
        const displayMode = readConfObject(config, 'displayMode') as string

        return renderToAbstractCanvas(width, height, renderProps, ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            renderArgs: {
              ...renderProps,
              features,
              layout,
              displayMode,
            },
          }),
        )
      },
    )

    const result = await super.render({
      ...renderProps,
      ...res,
      layout,
      height,
      width,
    })

    return {
      ...result,
      ...res,
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }
  }
}
