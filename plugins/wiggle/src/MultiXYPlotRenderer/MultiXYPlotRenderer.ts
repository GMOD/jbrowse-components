import { Feature } from '@jbrowse/core/util'
import { drawXY } from '../drawxy'
import { groupBy, YSCALEBAR_LABEL_OFFSET } from '../util'

import WiggleBaseRenderer, {
  MultiRenderArgsDeserialized as MultiArgs,
} from '../WiggleBaseRenderer'

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { sources, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    const Color = await import('color').then(f => f.default)
    let feats = [] as Feature[]
    sources.forEach(source => {
      const features = groups[source.name]
      if (!features) {
        return
      }
      const { reducedFeatures } = drawXY(ctx, {
        ...props,
        features,
        offset: YSCALEBAR_LABEL_OFFSET,
        colorCallback: () => source.color || 'blue',
        Color,
      })
      feats = feats.concat(reducedFeatures)
    })
    return { reducedFeatures: feats }
  }
}
