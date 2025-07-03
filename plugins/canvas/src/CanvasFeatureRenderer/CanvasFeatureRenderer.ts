import { readConfObject } from '@jbrowse/core/configuration'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { chooseGlyphComponent } from './components/util'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

// used to make features have a little padding for their labels
const yPadding = 5

export default class CanvasFeatureRenderer extends BoxRendererType {
  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { regions, bpPerPx, config } = renderProps

    const layout = this.createLayoutInWorker(renderProps)
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    await updateStatus(
      'Creating layout',
      renderProps.statusCallback as (arg: string) => void, // Cast to correct type
      async () => {
        const displayMode = readConfObject(config, 'displayMode') as string
        for (const feature of features.values()) {
          const featureStart = feature.get('start')
          const featureEnd = feature.get('end')

          const featureHeight = chooseGlyphComponent({
            config,
            feature,
          }).getHeight({ displayMode, feature, config })

          ;(layout as BaseLayout<Feature>).addRect(
            feature.id(),
            featureStart,
            featureEnd,
            featureHeight + yPadding,
          )
        }
      },
    )

    const result = await updateStatus(
      'Rendering features',
      renderProps.statusCallback as (arg: string) => void, // Cast to correct type
      async () => {
        const height = (layout as BaseLayout<Feature>).getTotalHeight()
        const canvasResult = renderToAbstractCanvas(
          width,
          height,
          renderProps,
          ctx => {
            const displayMode = readConfObject(config, 'displayMode') as string
            for (const feature of features.values()) {
              const featureStart = feature.get('start')
              const featureEnd = feature.get('end')

              const featureWidthPx = (featureEnd - featureStart) / bpPerPx
              const GlyphComponent = chooseGlyphComponent({ config, feature })
              const featureHeight = GlyphComponent.getHeight({
                displayMode,
                feature,
                config,
              })

              const topPx = (layout as BaseLayout<Feature>).addRect(
                feature.id(),
                featureStart,
                featureEnd,
                featureHeight + yPadding,
              )

              if (topPx === null) {
                continue // Skip if feature cannot be laid out
              }

              const x = (featureStart - region.start) / bpPerPx
              const y = topPx
              const h = featureHeight
              const w = featureWidthPx

              GlyphComponent.draw({
                feature,
                displayMode,
                x,
                y,
                width: w,
                height: h,
                config,
                region,
                bpPerPx,
                topLevel: true,
                colorByCDS: false, // This needs to be passed from config if applicable
                ctx,
              })
            }
            return {} // Return an empty object
          },
        )
        return canvasResult
      },
    )

    const results = await super.render({
      ...renderProps,
      ...result,
      features,
      layout: layout as BaseLayout<Feature>, // Cast layout to BaseLayout<Feature>
      height: layout.getTotalHeight(),
      width,
    })

    return {
      ...results,
      ...result,
      features: new Map(),
      layout: layout as BaseLayout<Feature>, // Cast layout to BaseLayout<Feature>
      height: layout.getTotalHeight(),
      width,
      maxHeightReached: (layout as BaseLayout<Feature>).maxHeightReached,
      containsNoTransferables: true,
    }
  }
}
