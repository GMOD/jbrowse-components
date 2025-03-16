import { groupBy } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import WiggleBaseRenderer from '../WiggleBaseRenderer'

import type { MultiRenderArgsDeserialized as MultiArgs } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class MultiDensityPlotRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { stopToken, sources, features } = props
    checkStopToken(stopToken)
    const groups = groupBy(features.values(), f => f.get('source'))
    const height = props.height / sources.length
    let feats = [] as Feature[]
    const { drawDensity } = await import('../drawDensity')
    ctx.save()
    let start = performance.now()
    for (const source of sources) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      const features = groups[source.name] || []
      const { reducedFeatures } = drawDensity(ctx, {
        ...props,
        features,
        height,
      })
      ctx.translate(0, height)
      feats = feats.concat(reducedFeatures)
    }
    ctx.restore()
    return {
      reducedFeatures: feats,
    }
  }
}
