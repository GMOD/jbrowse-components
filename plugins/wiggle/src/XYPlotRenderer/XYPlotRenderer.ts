import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'
import Color from 'color'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { getOrigin, getScale } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'
import { YSCALEBAR_LABEL_OFFSET } from '../LinearWiggleDisplay/models/model'

export default class XYPlotRenderer extends WiggleBaseRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const {
      features,
      bpPerPx,
      regions,
      scaleOpts,
      height: unadjustedHeight,
      config,
      ticks: { values },
      displayCrossHatches,
    } = props
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const offset = YSCALEBAR_LABEL_OFFSET
    const height = unadjustedHeight - offset * 2

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

    const toY = (n: number) => height - scale(n) + offset
    const toHeight = (n: number) => toY(originY) - toY(n)

    const colorCallback =
      readConfObject(config, 'color') === '#f0f'
        ? (_: Feature, score: number) =>
            score < pivotValue ? negColor : posColor
        : (feature: Feature, _score: number) =>
            readConfObject(config, 'color', { feature })

    ctx.strokeStyle = 'grey'
    ctx.moveTo(0, toY(0))
    ctx.lineTo(width, toY(0))
    ctx.stroke()

    const crossingOrigin = niceMin < pivotValue && niceMax > pivotValue
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      let score = feature.get('score')
      const maxr = feature.get('maxScore')
      const minr = feature.get('minScore')

      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.4 // fudge factor for subpixel rendering

      const summary = feature.get('summary')

      if (summaryScoreMode === 'max') {
        score = summary ? maxr : score
        ctx.fillStyle = colorCallback(feature, score)
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      } else if (summaryScoreMode === 'min') {
        score = summary ? minr : score
        ctx.fillStyle = colorCallback(feature, score)
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      } else if (summaryScoreMode === 'whiskers') {
        const c = colorCallback(feature, score)
        if (summary) {
          ctx.fillStyle = crossingOrigin
            ? colorCallback(feature, maxr)
            : Color(c).lighten(0.6).toString()
          ctx.fillRect(
            leftPx,
            toY(maxr),
            w,
            filled ? toHeight(maxr) - toHeight(score) : 1,
          )
        }

        // normal
        ctx.fillStyle =
          crossingOrigin && summary
            ? Color(colorCallback(feature, maxr)).mix(
                Color(colorCallback(feature, minr)),
              )
            : c
        ctx.fillRect(
          leftPx,
          toY(score),
          w,
          filled ? toHeight(score) - (summary ? toHeight(minr) : 0) : 1,
        )

        // min
        if (summary) {
          ctx.fillStyle = crossingOrigin
            ? colorCallback(feature, minr)
            : Color(c).darken(0.6).toString()
          ctx.fillRect(leftPx, toY(minr), w, filled ? toHeight(minr) : 1)
        }
      } else {
        ctx.fillStyle = colorCallback(feature, score)
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      }

      if (highClipping) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, 0, w, 4)
      } else if (lowClipping && scaleOpts.scaleType !== 'log') {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, unadjustedHeight - 4, w, 4)
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
