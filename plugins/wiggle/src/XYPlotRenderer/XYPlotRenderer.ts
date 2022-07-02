import { readConfObject } from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util'
import { drawFeats } from '../drawxy'
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rc = (s: string, rest?: Record<string, any>) =>
      readConfObject(config, s, rest)

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const pivotValue = rc('bicolorPivotValue')
    const negColor = rc('negColor')
    const posColor = rc('posColor')
    const Color = await import('color').then(f => f.default)

    drawFeats(ctx, {
      ...props,
      colorCallback:
        rc('color') === '#f0f'
          ? (_: Feature, score: number) =>
              score < pivotValue ? negColor : posColor
          : (feature: Feature, _score: number) => rc('color', { feature }),
      offset: YSCALEBAR_LABEL_OFFSET,
      features: [...features.values()],
      Color,
    })
  }
}
