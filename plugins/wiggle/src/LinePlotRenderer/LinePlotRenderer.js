import { featureSpanPx } from '@gmod/jbrowse-core/util'
import * as d3 from 'd3'
import { getScale } from '../util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'

export default class extends WiggleBaseRenderer {
  draw(context, props) {
    const { features, regions, bpPerPx, scaleOpts, height } = props
    const region = regions[0]
    const scale = getScale({ ...scaleOpts, range: [height, 0] })
    const line = d3
      .line()
      .y(d => scale(d[1]))
      .context(context)
    const data1 = []
    const data2 = []
    const data3 = []
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      const maxScore = feature.get('maxScore')
      const minScore = feature.get('maxScore')
      data1.push([(leftPx + rightPx) / 2, score])
      data2.push([(leftPx + rightPx) / 2, maxScore])
      data3.push([(leftPx + rightPx) / 2, minScore])
    }

    context.beginPath()
    context.strokeStyle = 'green'
    line(data1)
    context.stroke()

    context.beginPath()
    context.strokeStyle = 'blue'
    line(data2)
    context.stroke()

    context.beginPath()
    context.strokeStyle = 'red'
    line(data3)
    context.stroke()
  }
}
