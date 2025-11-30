import { BoxRendererType } from '@jbrowse/core/pluggableElementTypes'
import { updateStatus } from '@jbrowse/core/util'

import { computeLayouts, createRenderConfigContext } from './components/util'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

export default class SvgFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps
    const configContext = createRenderConfigContext(config)

    await updateStatus('Computing feature layout', statusCallback, () => {
      computeLayouts({
        features,
        bpPerPx,
        region: regions[0]!,
        config,
        configContext,
        layout,
      })
    })

    return {
      ...(await super.render({ ...renderProps, layout, configContext })),
      layout,
      configContext,
    }
  }
}
