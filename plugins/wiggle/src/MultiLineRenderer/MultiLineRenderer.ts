import { groupBy } from '@jbrowse/core/util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { drawLine } from '../drawLine'
import type { MultiRenderArgsDeserialized as MultiArgs } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class MultiLineRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { sources, features } = props
    const groups = groupBy(features.values(), f => f.get('source'))
    let feats = [] as Feature[]
    sources.forEach(source => {
      const { reducedFeatures } = drawLine(ctx, {
        ...props,
        features: groups[source.name] || [],
        colorCallback: () => source.color || 'blue',
      })
      feats = feats.concat(reducedFeatures)
    })
    return { reducedFeatures: feats }
  }
}
