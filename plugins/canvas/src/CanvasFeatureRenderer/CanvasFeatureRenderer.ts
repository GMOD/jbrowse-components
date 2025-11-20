import { readConfObject } from '@jbrowse/core/configuration'
import { BoxRendererType } from '@jbrowse/core/pluggableElementTypes'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

export default class CanvasFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps
    const region = regions[0]!
    const width = Math.max(1, (region.end - region.start) / bpPerPx)

    // Compute layouts for all features
    const layoutRecords = await updateStatus(
      'Computing feature layout',
      statusCallback,
      async () => {
        const { computeLayouts } = await import('./computeLayouts')
        return computeLayouts({
          features,
          bpPerPx,
          region,
          config,
          layout,
        })
      },
    )

    const height = Math.max(1, layout.getTotalHeight())

    // Fetch peptide data for CDS features
    const peptideDataMap = await updateStatus(
      'Fetching peptide data',
      statusCallback,
      async () => {
        const { fetchPeptideData } = await import('./peptideUtils')
        return fetchPeptideData(this.pluginManager, renderProps, features)
      },
    )

    // Render to canvas
    const res = await updateStatus(
      'Rendering features',
      statusCallback,
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
              peptideDataMap,
              colorByCDS: (renderProps as any).colorByCDS,
            },
          }),
        )
      },
    )

    const result = await super.render({
      ...renderProps,
      ...res,
      features,
      layout,
      height,
      width,
    })

    return {
      ...result,
      ...res,
      features: new Map(),
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
      containsNoTransferables: true,
    }
  }
}
