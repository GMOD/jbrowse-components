import { featureSpanPx } from '@jbrowse/core/util'
import * as d3 from 'd3'
import { getScale } from '../util'
import WiggleBaseRenderer, {
  WiggleBaseRendererProps,
} from '../WiggleBaseRenderer'

export default class XYPlotRenderer extends WiggleBaseRenderer {
  draw(context: CanvasRenderingContext2D, props: WiggleBaseRendererProps) {
    const { features, regions, bpPerPx, scaleOpts, height } = props
    const region = regions[0]
    const scale = getScale({ ...scaleOpts, range: [height, 0] })
    const area = d3
      .area()
      .y1(d => scale(d[1]))
      .y0(height)
      .context(context)
    const data = []
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('maxScore') || feature.get('score')
      data.push([(leftPx + rightPx) / 2, score])
    }

    context.beginPath()
    // @ts-ignore
    area(data)
    context.fill()
  }
}
