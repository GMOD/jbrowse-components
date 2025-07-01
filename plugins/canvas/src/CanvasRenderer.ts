import { readConfObject } from '@jbrowse/core/configuration'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { chooseGlyphComponent } from './CanvasFeatureRenderer/components/util'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout, SceneGraph } from '@jbrowse/core/util/layouts'

export default class CanvasRenderer extends BoxRendererType {
  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { regions, bpPerPx, config, displayMode, layout } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx
    const maxHeight = readConfObject(config, 'maxHeight')

    const result = await updateStatus(
      'Rendering features',
      renderProps.statusCallback as (arg: string) => void, // Cast to correct type
      async () => {
        const height = (layout as BaseLayout<Feature>).getTotalHeight()
        const canvasResult = renderToAbstractCanvas(width, height, renderProps, ctx => {
          for (const feature of features.values()) {
            const rootLayout = (layout as SceneGraph).getSubRecord(String(feature.id())) // Cast layout to SceneGraph
            if (rootLayout) {
              const GlyphComponent = chooseGlyphComponent({ config, feature })
              GlyphComponent.draw({
                feature,
                featureLayout: rootLayout,
                config,
                region,
                bpPerPx,
                topLevel: true,
                colorByCDS: false, // This needs to be passed from config if applicable
                ctx,
                displayMode,
                reversed: region.reversed,
              })
            }
          }
          return {} // Return an empty object
        })
        return canvasResult
      },
    )

    const results = await super.render({
      ...renderProps,
      ...result,
      features,
      layout: layout as BaseLayout<Feature>, // Cast layout to BaseLayout<Feature>
      height: result.height,
      width,
    })

    return {
      ...results,
      ...result,
      features: new Map(),
      layout: layout as BaseLayout<Feature>, // Cast layout to BaseLayout<Feature>
      height: result.height,
      width,
      maxHeightReached: (layout as BaseLayout<Feature>).maxHeightReached,
      containsNoTransferables: true,
    }
  }
}