import { Feature } from '@jbrowse/core/util'
import { groupBy } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'
import { drawDensity } from '../drawxy'

interface MultiArgs extends RenderArgsDeserializedWithFeatures {
  sources: string[]
  sourceColors: { [key: string]: string }
}

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { bpPerPx, sources, regions, features } = props
    const [region] = regions
    const groups = groupBy([...features.values()], f => f.get('source'))
    const height = props.height / Object.keys(groups).length
    const width = (region.end - region.start) / bpPerPx
    let feats = [] as Feature[]
    ctx.save()
    sources.forEach(source => {
      const features = groups[source]
      if (!features) {
        return
      }
      const { reducedFeatures } = drawDensity(ctx, {
        ...props,
        features,
        height,
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
