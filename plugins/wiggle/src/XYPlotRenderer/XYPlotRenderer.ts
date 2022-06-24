import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util'
import { getOrigin, getScale } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'
import { YSCALEBAR_LABEL_OFFSET } from '../LinearWiggleDisplay/models/model'

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color?: string,
) {
  if (color) {
    ctx.fillStyle = String(color)
  }
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }
  ctx.fillRect(x, y, width, height)
}

export default class XYPlotRenderer extends WiggleBaseRenderer {
  async draw(
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
      ticks,
      displayCrossHatches,
    } = props
    const Color = await import('color').then(f => f.default)
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rc = (s: string, rest?: Record<string, any>) =>
      readConfObject(config, s, rest)

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const offset = YSCALEBAR_LABEL_OFFSET
    const height = unadjustedHeight - offset * 2

    const pivotValue = rc('bicolorPivotValue')
    const negColor = rc('negColor')
    const posColor = rc('posColor')
    const filled = rc('filled')
    const clipColor = rc('clipColor')
    const highlightColor = rc('highlightColor')
    const summaryScoreMode = rc('summaryScoreMode')

    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const [niceMin, niceMax] = scale.domain()

    const toY = (n: number) => height - (scale(n) || 0) + offset
    const toHeight = (n: number) => toY(originY) - toY(n)

    const colorCallback =
      rc('color') === '#f0f'
        ? (_: Feature, score: number) =>
            score < pivotValue ? negColor : posColor
        : (feature: Feature, _score: number) => rc('color', { feature })

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
        fillRect(
          ctx,
          leftPx,
          toY(score),
          w,
          filled ? toHeight(score) : 1,
          colorCallback(feature, score),
        )
      } else if (summaryScoreMode === 'min') {
        score = summary ? minr : score
        fillRect(
          ctx,
          leftPx,
          toY(score),
          w,
          filled ? toHeight(score) : 1,
          colorCallback(feature, score),
        )
      } else if (summaryScoreMode === 'whiskers') {
        const c = colorCallback(feature, score)
        if (summary) {
          fillRect(
            ctx,
            leftPx,
            toY(maxr),
            w,
            filled ? toHeight(maxr) - toHeight(score) : 1,
            crossingOrigin
              ? colorCallback(feature, maxr)
              : Color(c).lighten(0.6),
          )
        }

        // normal
        fillRect(
          ctx,
          leftPx,
          toY(score),
          w,
          filled ? toHeight(score) - (summary ? toHeight(minr) : 0) : 1,
          crossingOrigin && summary
            ? Color(colorCallback(feature, maxr)).mix(
                Color(colorCallback(feature, minr)),
              )
            : c,
        )

        // min
        if (summary) {
          fillRect(
            ctx,
            leftPx,
            toY(minr),
            w,
            filled ? toHeight(minr) : 1,
            crossingOrigin
              ? colorCallback(feature, minr)
              : Color(c).darken(0.6),
          )
        }
      } else {
        fillRect(
          ctx,
          leftPx,
          toY(score),
          w,
          filled ? toHeight(score) : 1,
          colorCallback(feature, score),
        )
      }

      if (highClipping) {
        fillRect(ctx, leftPx, 0, w, 4, clipColor)
      } else if (lowClipping && scaleOpts.scaleType !== 'log') {
        fillRect(ctx, leftPx, unadjustedHeight - 4, w, 4, clipColor)
      }
      if (feature.get('highlighted')) {
        fillRect(ctx, leftPx, 0, w, height, highlightColor)
      }
    }

    if (displayCrossHatches) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ticks.values.forEach(tick => {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(toY(tick)))
        ctx.lineTo(width, Math.round(toY(tick)))
        ctx.stroke()
      })
    }
  }
}
