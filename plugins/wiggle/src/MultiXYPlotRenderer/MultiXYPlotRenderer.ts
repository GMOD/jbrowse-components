import { groupBy, Feature } from '@jbrowse/core/util'
import { drawXY } from '../drawxy'
import { YSCALEBAR_LABEL_OFFSET } from '../util'

import WiggleBaseRenderer, {
  MultiRenderArgsDeserialized as MultiArgs,
} from '../WiggleBaseRenderer'

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { sources, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    let feats = [] as Feature[]
    for (const source of sources) {
      const features = groups[source.name]
      if (!features) {
        continue
      }
      const { reducedFeatures } = drawXY(ctx, {
        ...props,
        features,
        offset: YSCALEBAR_LABEL_OFFSET,
        colorCallback: () => source.color || 'blue',
      })
      feats = [...feats, ...reducedFeatures]
    }
    return { reducedFeatures: feats }
  }
}
