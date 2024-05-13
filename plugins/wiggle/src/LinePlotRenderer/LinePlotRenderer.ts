import { readConfObject } from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

import { YSCALEBAR_LABEL_OFFSET } from '../util'
import { drawLine } from '../drawLine'

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
