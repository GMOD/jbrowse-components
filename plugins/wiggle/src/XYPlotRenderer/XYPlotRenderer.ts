import { readConfObject } from '@jbrowse/core/configuration'

import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { YSCALEBAR_LABEL_OFFSET } from '../util'

import type { RenderArgsDeserializedWithFeatures } from '../WiggleBaseRenderer'

export default class XYPlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { inverted, stopToken, features, config } = props
    const { drawXY } = await import('../drawXY')

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')

    return drawXY(ctx, {
      ...props,
      colorCallback: !config.color.isCallback
        ? (_feature, score) => (score < pivotValue ? negColor : posColor)
        : (feature, _score) => readConfObject(config, 'color', { feature }),
      offset: YSCALEBAR_LABEL_OFFSET,
      features: [...features.values()],
      inverted,
      stopToken,
    })
  }
}
