import { readConfObject } from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util'
import { drawXY } from '../drawxy'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'
import { YSCALEBAR_LABEL_OFFSET } from '../util'

export default class XYPlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { features, config } = props

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const Color = await import('color').then(f => f.default)

    return drawXY(ctx, {
      ...props,
      colorCallback:
        readConfObject(config, 'color') === '#f0f'
          ? (_: Feature, score: number) =>
              score < pivotValue ? negColor : posColor
          : (feature: Feature, _score: number) =>
              readConfObject(config, 'color', { feature }),
      offset: YSCALEBAR_LABEL_OFFSET,
      features: [...features.values()],
      Color,
    })
  }
}
