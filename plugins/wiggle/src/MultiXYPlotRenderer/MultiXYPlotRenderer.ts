import { forEachWithStopTokenCheck, groupBy } from '@jbrowse/core/util'

import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { YSCALEBAR_LABEL_OFFSET } from '../util'

import type { MultiRenderArgsDeserialized as MultiArgs } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { stopToken, sources, features } = props
    const groups = groupBy(features.values(), f => f.get('source'))
    const { drawXY } = await import('../drawXY')
    let feats = [] as Feature[]
    forEachWithStopTokenCheck(sources, stopToken, source => {
      const features = groups[source.source] || []
      const { reducedFeatures } = drawXY(ctx, {
        ...props,
        features,
        offset: YSCALEBAR_LABEL_OFFSET,
        colorCallback: () => source.color || 'blue',
      })
      feats = feats.concat(reducedFeatures)
    })
    return { reducedFeatures: feats }
  }
}
