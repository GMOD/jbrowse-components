import { groupBy } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'
import { drawDensity } from '../drawxy'

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { bpPerPx, regions, features } = props
    const [region] = regions
    const groups = groupBy([...features.values()], f => f.get('source'))
    const list = Object.values(groups)
    const height = props.height / list.length
    const width = (region.end - region.start) / bpPerPx
    ctx.save()
    list.forEach(features => {
      drawDensity(ctx, {
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
    })
    ctx.restore()
  }
}
