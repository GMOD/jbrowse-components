import { Feature } from '@jbrowse/core/util'
import { drawXY } from '../drawxy'
import { groupBy, YSCALEBAR_LABEL_OFFSET } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

interface MultiRenderArgs extends RenderArgsDeserializedWithFeatures {
  sources: string[]
  sourceColors: { [key: string]: string }
}

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiRenderArgs) {
    const { sources, sourceColors, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    const Color = await import('color').then(f => f.default)
    let feats = [] as Feature[]
    sources.forEach(source => {
      const features = groups[source]
      if (!features) {
        return
      }
      const { reducedFeatures } = drawXY(ctx, {
        ...props,
        features,
        offset: YSCALEBAR_LABEL_OFFSET,
        colorCallback: () => sourceColors[source],
        Color,
      })
      feats = feats.concat(reducedFeatures)
    })
    return { reducedFeatures: feats }
  }
}
