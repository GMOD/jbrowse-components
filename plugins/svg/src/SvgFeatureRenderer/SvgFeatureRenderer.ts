import { readConfObject } from '@jbrowse/core/configuration'
import { BoxRendererType } from '@jbrowse/core/pluggableElementTypes'
import { updateStatus } from '@jbrowse/core/util'

import { layoutFeatures } from './components/util'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

export default class SvgFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps

    await updateStatus('Computing feature layout', statusCallback, () => {
      layoutFeatures({
        features,
        bpPerPx,
        region: regions[0]!,
        config,
        layout,
        displayMode: readConfObject(config, 'displayMode'),
        extraGlyphs: (renderProps as any).extraGlyphs,
      })
    })

    return {
      ...(await super.render({ ...renderProps, layout })),
      layout,
    }
  }
}
