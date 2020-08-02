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
    // const walkY = d3.scaleLinear().domain([0, 1000]).range([0, width])
    const line = d3
      .line()
      .curve(d3.curveCardinal)
      .y(d => scale(d[1]))
      .context(context)
    const data = []
    context.beginPath()
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const [niceMin, niceMax] = scale.domain()
    let colorCallback
    if (readConfObject(config, 'color') === '#f0f') {
      colorCallback = feature =>
        feature.get('score') < pivotValue ? negColor : posColor
    } else {
      colorCallback = feature => readConfObject(config, 'color', [feature])
    }
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      data.push([(leftPx + rightPx) / 2, score])
      // data.push([leftPx, score])
      // data.push([rightPx, score])
    }

    line(data)
    context.stroke()
  }
}
