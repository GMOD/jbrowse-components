import { readConfObject } from '@jbrowse/core/configuration'
import WiggleBaseRenderer from '../WiggleBaseRenderer'

import { drawLine } from '../drawLine'
import { YSCALEBAR_LABEL_OFFSET } from '../util'
import type { RenderArgsDeserializedWithFeatures } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class LinePlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { config } = props
    const c = readConfObject(config, 'color')
    return drawLine(ctx, {
      ...props,
      offset: YSCALEBAR_LABEL_OFFSET,
      colorCallback:
        c === '#f0f'
          ? () => 'grey'
          : (feature: Feature) => readConfObject(config, 'color', { feature }),
    })
  }
}
