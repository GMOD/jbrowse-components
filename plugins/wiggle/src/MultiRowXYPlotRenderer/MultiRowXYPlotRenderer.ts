import { groupBy } from '../util'
import { drawFeats } from '../drawxy'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

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
    const Color = await import('color').then(f => f.default)
    ctx.save()
    sources.forEach(source => {
      drawFeats(ctx, {
        ...props,
        features: groups[source],
        height,
        colorCallback: () => 'blue',
        Color,
      })
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(width, height)
      ctx.stroke()
      ctx.translate(0, height)
    })
    ctx.restore()
  }
}
