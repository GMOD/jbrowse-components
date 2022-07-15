import { Feature } from '@jbrowse/core/util'
import { drawLine } from '../drawxy'
import { groupBy } from '../util'

import WiggleBaseRenderer, {
  MultiRenderArgsDeserialized as MultiArgs,
} from '../WiggleBaseRenderer'

export default class MultiLineRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { sources, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    let feats = [] as Feature[]
    sources.forEach(source => {
      const features = groups[source.name]
      if (!features) {
        return
      }
      const { reducedFeatures } = drawLine(ctx, {
        ...props,
        features,
        colorCallback: () => source.color || 'blue',
      })
      feats = feats.concat(reducedFeatures)
    })
    return { reducedFeatures: feats }
  }
}
