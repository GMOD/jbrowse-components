import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import * as d3 from 'd3'
import { getScale } from '../util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'

export default class extends WiggleBaseRenderer {
  draw(context, props) {
    const { features, regions, bpPerPx, scaleOpts, height, config } = props
    const region = regions[0]
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const line = d3
      .line()
      .curve(d3.curveBasis)
      .y(d => scale(d[1]))
      .context(context)
    const data = []
    context.beginPath()
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      data.push([(leftPx + rightPx) / 2, score])
    }

    line(data)
    context.stroke()
  }
}
