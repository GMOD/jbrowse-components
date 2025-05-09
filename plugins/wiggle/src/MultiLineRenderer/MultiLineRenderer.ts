import { forEachWithStopTokenCheck, groupBy } from '@jbrowse/core/util'

import WiggleBaseRenderer from '../WiggleBaseRenderer'

import type { MultiRenderArgsDeserialized as MultiArgs } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class MultiLineRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { stopToken, sources, features } = props
    const groups = groupBy(features.values(), f => f.get('source'))
    const { drawLine } = await import('../drawLine')
    let feats = [] as Feature[]
    forEachWithStopTokenCheck(sources, stopToken, source => {
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
