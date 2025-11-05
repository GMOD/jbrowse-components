import { forEachWithStopTokenCheck, groupBy } from '@jbrowse/core/util'

import WiggleBaseRenderer from '../WiggleBaseRenderer'

import type { MultiRenderArgsDeserialized as MultiArgs } from '../WiggleBaseRenderer'
import type { Feature } from '@jbrowse/core/util'

export default class MultiRowLineRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { stopToken, bpPerPx, sources, regions, features } = props
    const region = regions[0]!
    const groups = groupBy(features.values(), f => f.get('source'))
    const height = props.height / sources.length
    const width = (region.end - region.start) / bpPerPx
    const { drawLine } = await import('../drawLine')
    let feats = [] as Feature[]
    ctx.save()
    forEachWithStopTokenCheck(sources, stopToken, source => {
      const { reducedFeatures } = drawLine(ctx, {
        ...props,
        features: groups[source.source] || [],
        height,
        colorCallback: () => source.color || 'blue',
      })
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(width, height)
      ctx.stroke()
      ctx.translate(0, height)
      feats = feats.concat(reducedFeatures)
    })
    ctx.restore()
    return { reducedFeatures: feats }
  }
}
