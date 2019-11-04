import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import Color from 'color'
import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { getOrigin, getScale } from '../util'

export default class XYPlotRenderer extends WiggleBaseRenderer {
  draw(ctx, props) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const filled = readConfObject(config, 'filled')
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'highlightColor')
    const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const [niceMin, niceMax] = scale.domain()
    const toY = rawscore => height - scale(rawscore)
    const toHeight = rawscore => toY(originY) - toY(rawscore)
    let colorCallback
    if (readConfObject(config, 'color') === '#f0f') {
      colorCallback = feature =>
        feature.get('score') < pivotValue ? negColor : posColor
    } else {
      colorCallback = feature => readConfObject(config, 'color', [feature])
    }

    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(
        feature,
        region,
        bpPerPx,
        horizontallyFlipped,
      )
      let score = feature.get('score')
      const maxr = feature.get('maxScore')
      const minr = feature.get('minScore')

      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

      const c = colorCallback(feature)
      if (summaryScoreMode === 'max') {
        score = maxr === undefined ? score : maxr
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      } else if (summaryScoreMode === 'min') {
        score = minr === undefined ? score : minr
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      } else if (summaryScoreMode === 'whiskers') {
        // max
        if (maxr !== undefined) {
          ctx.fillStyle = Color(c)
            .lighten(0.6)
            .toString()
          ctx.fillRect(leftPx, toY(maxr), w, filled ? toHeight(maxr) : 1)
        }

        // normal
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
        // min
        if (minr !== undefined) {
          ctx.fillStyle = Color(c)
            .darken(0.6)
            .toString()
          ctx.fillRect(leftPx, toY(minr), w, filled ? toHeight(minr) : 1)
        }
      } else {
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      }

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
