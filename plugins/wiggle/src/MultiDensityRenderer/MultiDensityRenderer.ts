import { groupBy } from '@jbrowse/core/util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { drawDensity } from '../drawDensity'
import type { MultiRenderArgsDeserialized as MultiArgs } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { sources, features } = props
    const groups = groupBy(features.values(), f => f.get('source'))
    const height = props.height / sources.length
    let feats = [] as Feature[]
    ctx.save()
    sources.forEach(source => {
      const features = groups[source.name] || []
      const { reducedFeatures } = drawDensity(ctx, {
        ...props,
        features,
        height,
      })
      ctx.translate(0, height)
      feats = feats.concat(reducedFeatures)
    })
    ctx.restore()
    return { reducedFeatures: feats }
  }
}
