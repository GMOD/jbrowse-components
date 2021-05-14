import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'
import { getScale } from '../util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { YSCALEBAR_LABEL_OFFSET } from '../LinearWiggleDisplay/models/model'

export default class LinePlotRenderer extends WiggleBaseRenderer {
  draw(ctx, props) {
    const {
      features,
      regions,
      bpPerPx,
      scaleOpts,
      height: unadjustedHeight,
      ticks: { values },
      displayCrossHatches,
      config,
    } = props
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    const offset = YSCALEBAR_LABEL_OFFSET

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const height = unadjustedHeight - offset * 2
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'highlightColor')
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const [niceMin, niceMax] = scale.domain()
    const toY = rawscore => height - scale(rawscore) + offset
    const colorCallback =
      readConfObject(config, 'color') === '#f0f'
        ? () => 'grey'
        : feature => readConfObject(config, 'color', { feature })

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

    if (displayCrossHatches) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      values.forEach(tick => {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(toY(tick)))
        ctx.lineTo(width, Math.round(toY(tick)))
        ctx.stroke()
      })
    }
  }
}
