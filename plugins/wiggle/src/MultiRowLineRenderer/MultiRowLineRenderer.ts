import { groupBy, Feature } from '@jbrowse/core/util'
import { drawLine } from '../drawxy'
import WiggleBaseRenderer, {
  MultiRenderArgsDeserialized as MultiArgs,
} from '../WiggleBaseRenderer'

export default class MultiRowLineRenderer extends WiggleBaseRenderer {
  // @ts-expect-error
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { bpPerPx, sources, regions, features } = props
    const [region] = regions
    const groups = groupBy([...features.values()], f => f.get('source'))
    const height = props.height / Object.keys(groups).length
    const width = (region.end - region.start) / bpPerPx
    let feats = [] as Feature[]
    ctx.save()
    sources.forEach(source => {
      const { reducedFeatures } = drawLine(ctx, {
        ...props,
        features: groups[source.name],
        height,
        colorCallback: () => source.color || 'blue',
      })
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(width, height)
      ctx.stroke()
      ctx.translate(0, height)
      feats = [...feats, ...reducedFeatures]
    })
    ctx.restore()
    return { reducedFeatures: feats }
  }
}
