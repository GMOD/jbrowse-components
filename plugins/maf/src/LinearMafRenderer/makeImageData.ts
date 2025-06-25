import { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { Feature, featureSpanPx, measureText } from '@jbrowse/core/util'

import {
  fillRect,
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
} from './util'

interface Sample {
  id: string
  color?: string
}
interface RenderArgs extends RenderArgsDeserialized {
  samples: Sample[]
  rowHeight: number
  rowProportion: number
  showAllLetters: boolean
  mismatchRendering: boolean
  features: Map<string, Feature>
  statusCallback?: (arg: string) => void
  showAsUpperCase: boolean
}

function getLetter(a: string, showAsUpperCase: boolean) {
  return showAsUpperCase ? a.toUpperCase() : a
}

export function makeImageData({
  ctx,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  renderArgs: RenderArgs
}) {
  const {
    regions,
    bpPerPx,
    rowHeight,
    showAllLetters,
    theme: configTheme,
    mismatchRendering,
    samples,
    rowProportion,
    features,
    showAsUpperCase,
  } = renderArgs
  const region = regions[0]!
  const canvasWidth = (region.end - region.start) / bpPerPx
  const h = rowHeight * rowProportion
  const theme = createJBrowseTheme(configTheme)
  const colorForBase = getColorBaseMap(theme)
  const contrastForBase = getContrastBaseMap(theme)

  const { charHeight } = getCharWidthHeight()
  const sampleToRowMap = new Map(samples.map((s, i) => [s.id, i]))
  const scale = 1 / bpPerPx
  const f = 0.4
  const h2 = rowHeight / 2
  const hp2 = h / 2
  const offset = (rowHeight - h) / 2

  // sample as alignments
  ctx.font = 'bold 10px Courier New,monospace'

  for (const feature of features.values()) {
    const [leftPx] = featureSpanPx(feature, region, bpPerPx)
    const vals = feature.get('alignments') as Record<string, { seq: string }>
    const seq = feature.get('seq').toLowerCase()
    const r = Object.entries(vals)
    for (const [sample, val] of r) {
      const origAlignment = val.seq
      const alignment = origAlignment.toLowerCase()

      const row = sampleToRowMap.get(sample)
      if (row === undefined) {
        continue
      }

      const t = rowHeight * row
      const t2 = offset + t

      // gaps
      ctx.beginPath()
      ctx.fillStyle = 'black'
      for (let i = 0, o = 0, l = alignment.length; i < l; i++) {
        if (seq[i] !== '-') {
          if (alignment[i] === '-') {
            const l = leftPx + scale * o
            ctx.moveTo(l, t + h2)
            ctx.lineTo(l + scale + f, t + h2)
          }
          o++
        }
      }
      ctx.stroke()

      if (!showAllLetters) {
        // matches
        ctx.fillStyle = 'lightgrey'
        for (let i = 0, o = 0, l = alignment.length; i < l; i++) {
          if (seq[i] !== '-') {
            const c = alignment[i]
            const l = leftPx + scale * o
            if (seq[i] === c && c !== '-' && c !== ' ') {
              fillRect(ctx, l, t2, scale + f, h, canvasWidth)
            }
            o++
          }
        }
      }

      // mismatches
      for (let i = 0, o = 0, l = alignment.length; i < l; i++) {
        const c = alignment[i]
        if (seq[i] !== '-') {
          if (c !== '-') {
            const l = leftPx + scale * o
            if (seq[i] !== c && c !== ' ') {
              fillRect(
                ctx,
                l,
                t2,
                scale + f,
                h,
                canvasWidth,
                mismatchRendering
                  ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    (colorForBase[c as keyof typeof colorForBase] ?? 'black')
                  : 'orange',
              )
            } else if (showAllLetters) {
              fillRect(
                ctx,
                l,
                t2,
                scale + f,
                h,
                canvasWidth,
                mismatchRendering
                  ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    (colorForBase[c as keyof typeof colorForBase] ?? 'black')
                  : 'lightblue',
              )
            }
          }
          o++
        }
      }

      // font
      const charSizeW = 10
      if (scale >= charSizeW) {
        for (let i = 0, o = 0, l = alignment.length; i < l; i++) {
          if (seq[i] !== '-') {
            const l = leftPx + scale * o
            const offset = (scale - charSizeW) / 2 + 1
            const c = alignment[i]!
            if ((showAllLetters || seq[i] !== c) && c !== '-') {
              ctx.fillStyle = mismatchRendering
                ? (contrastForBase[c] ?? 'white')
                : 'black'
              if (rowHeight > charHeight) {
                ctx.fillText(
                  getLetter(origAlignment[i] || '', showAsUpperCase),
                  l + offset,
                  hp2 + t + 3,
                )
              }
            }
            o++
          }
        }
      }
    }
  }

  // second pass for insertions, has slightly improved look since the
  // insertions are always 'on top' of the other features
  for (const feature of features.values()) {
    const [leftPx] = featureSpanPx(feature, region, bpPerPx)
    const vals = feature.get('alignments') as Record<string, { seq: string }>
    const seq = feature.get('seq').toLowerCase()

    for (const [sample, val] of Object.entries(vals)) {
      const origAlignment = val.seq
      const alignment = origAlignment.toLowerCase()
      const row = sampleToRowMap.get(sample)
      if (row === undefined) {
        continue
      }

      const t = rowHeight * row
      const t2 = offset + t
      for (let i = 0, o = 0, l = alignment.length; i < l; i++) {
        let ins = ''
        while (seq[i] === '-') {
          if (alignment[i] !== '-' && alignment[i] !== ' ') {
            ins += alignment[i]
          }
          i++
        }
        if (ins.length > 0) {
          const l = leftPx + scale * o - 1

          if (ins.length > 10) {
            const txt = `${ins.length}`
            if (bpPerPx > 10) {
              fillRect(ctx, l - 1, t2, 2, h, canvasWidth, 'purple')
            } else if (h > charHeight) {
              const rwidth = measureText(txt, 10)
              const padding = 2
              fillRect(
                ctx,
                l - rwidth / 2 - padding,
                t2,
                rwidth + 2 * padding,
                h,
                canvasWidth,
                'purple',
              )
              ctx.fillStyle = 'white'
              ctx.fillText(txt, l - rwidth / 2, t + h)
            } else {
              const padding = 2
              fillRect(
                ctx,
                l - padding,
                t2,
                2 * padding,
                h,
                canvasWidth,
                'purple',
              )
            }
          } else {
            fillRect(ctx, l, t2, 1, h, canvasWidth, 'purple')
            if (bpPerPx < 0.2 && rowHeight > 5) {
              fillRect(ctx, l - 2, t2, 5, 1, canvasWidth)
              fillRect(ctx, l - 2, t2 + h - 1, 5, 1, canvasWidth)
            }
          }
        }
        o++
      }
    }
  }
}
