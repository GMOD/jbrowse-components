import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'
import { getScale } from '../util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'

export default class extends WiggleBaseRenderer {
  draw(ctx, props) {
    const { features, regions, bpPerPx, scaleOpts, height, config } = props
    const [region] = regions
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'highlightColor')
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const [niceMin, niceMax] = scale.domain()
    const toY = rawscore => height - scale(rawscore)
    const width = (region.end - region.start) / bpPerPx
    const colorCallback =
      readConfObject(config, 'color') === '#f0f'
        ? // eslint-disable-next-line @typescript-eslint/no-unused-vars
          feature => 'grey'
        : feature => readConfObject(config, 'color', [feature])

    ctx.strokeStyle = 'grey'
    ctx.moveTo(0, toY(0))
    ctx.lineTo(width, toY(0))
    ctx.stroke()

    let lastVal
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

      const c = colorCallback(feature)

      ctx.strokeStyle = c
      ctx.beginPath()
      if (!region.reversed) {
        ctx.moveTo(
          leftPx,
          toY(typeof lastVal !== 'undefined' ? lastVal : score),
        )
        ctx.lineTo(leftPx, toY(score))
        ctx.lineTo(rightPx, toY(score))
      } else {
        ctx.moveTo(
          rightPx,
          toY(typeof lastVal !== 'undefined' ? lastVal : score),
        )
        ctx.lineTo(rightPx, toY(score))
        ctx.lineTo(leftPx, toY(score))
      }
      ctx.stroke()
      lastVal = score

      if (highClipping) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, 0, w, 4)
      } else if (lowClipping && scaleOpts.scaleType !== 'log') {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, height - 4, w, height)
      }
      if (feature.get('highlighted')) {
        ctx.fillStyle = highlightColor
        ctx.fillRect(leftPx, 0, w, height)
      }
    }
  }
}
