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
    const region = regions[0]!
    const displayMode = readConfObject(config, 'displayMode') as string

    await updateStatus(
      'Computing feature layout',
      statusCallback as (arg: string) => void,
      () => {
        layoutFeatures({
          features,
          bpPerPx,
          region,
          config,
          layout,
          displayMode,
          extraGlyphs: (renderProps as any).extraGlyphs,
        })
      },
    )

    return { features, layout }
  }
}
