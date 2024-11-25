import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { getSnapshot } from 'mobx-state-tree'

// locals
import type { Dotplot1DViewModel } from '../DotplotView/model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import type { Feature } from '@jbrowse/core/util'

const { parseCigar } = MismatchParser

export interface DotplotRenderArgsDeserialized extends RenderArgsDeserialized {
  adapterConfig: AnyConfigurationModel
  height: number
  width: number
  highResolutionScaling: number
  view: {
    hview: Dotplot1DViewModel
    vview: Dotplot1DViewModel
  }
}

const r = 'fell outside of range due to CIGAR string'
const lt = '(less than min coordinate of feature)'
const gt = '(greater than max coordinate of feature)'
const fudgeFactor = 1 // allow 1px fuzzyness before warn

function drawCir(ctx: CanvasRenderingContext2D, x: number, y: number, r = 1) {
  ctx.beginPath()
  ctx.arc(x, y, r / 2, 0, 2 * Math.PI)
  ctx.fill()
}

export async function drawDotplot(
  ctx: CanvasRenderingContext2D,
  props: DotplotRenderArgsDeserialized & { views: Dotplot1DViewModel[] },
) {
  const { config, views, height, drawCigar, theme } = props
  const color = readConfObject(config, 'color')
  const posColor = readConfObject(config, 'posColor')
  const negColor = readConfObject(config, 'negColor')
  const colorBy = readConfObject(config, 'colorBy')
  const lineWidth = readConfObject(config, 'lineWidth')
  const thresholds = readConfObject(config, 'thresholds')
  const palette = readConfObject(config, 'thresholdsPalette') as string[]
  const isCallback = config.color.isCallback
  const hview = views[0]!
  const vview = views[1]!
  const db1 = hview.dynamicBlocks.contentBlocks[0]?.offsetPx
  const db2 = vview.dynamicBlocks.contentBlocks[0]?.offsetPx
  const warnings = [] as { message: string; effect: string }[]
  ctx.lineWidth = lineWidth

  // we operate on snapshots of these attributes of the hview/vview because
  // it is significantly faster than accessing the mobx objects
  const { bpPerPx: hBpPerPx } = hview
  const { bpPerPx: vBpPerPx } = vview

  function clampWithWarnX(
    num: number,
    min: number,
    max: number,
    feature: Feature,
  ) {
    const strand = feature.get('strand') || 1
    if (strand === -1) {
      ;[max, min] = [min, max]
    }
    if (num < min - fudgeFactor) {
      let start = feature.get('start')
      let end = feature.get('end')
      const refName = feature.get('refName')
      if (strand === -1) {
        ;[end, start] = [start, end]
      }

      warnings.push({
        message: `feature at (X ${refName}:${start}-${end}) ${r} ${lt}`,
        effect: 'clipped the feature',
      })
      return min
    }
    if (num > max + fudgeFactor) {
      const strand = feature.get('strand') || 1
      const start = strand === 1 ? feature.get('start') : feature.get('end')
      const end = strand === 1 ? feature.get('end') : feature.get('start')
      const refName = feature.get('refName')

      warnings.push({
        message: `feature at (X ${refName}:${start}-${end}) ${r} ${gt}`,
        effect: 'clipped the feature',
      })
      return max
    }
    return num
  }

  function clampWithWarnY(
    num: number,
    min: number,
    max: number,
    feature: Feature,
  ) {
    if (num < min - fudgeFactor) {
      const mate = feature.get('mate')
      const { refName, start, end } = mate
      warnings.push({
        message: `feature at (Y ${refName}:${start}-${end}) ${r} ${lt}`,
        effect: 'clipped the feature',
      })
      return min
    }
    if (num > max + fudgeFactor) {
      const mate = feature.get('mate')
      const { refName, start, end } = mate

      warnings.push({
        message: `feature at (Y ${refName}:${start}-${end}) ${r} ${gt}`,
        effect: 'clipped the feature',
      })
      return max
    }
    return num
  }

  const hsnap = {
    ...getSnapshot(hview),
    staticBlocks: hview.staticBlocks,
    width: hview.width,
  }
  const vsnap = {
    ...getSnapshot(vview),
    staticBlocks: vview.staticBlocks,
    width: vview.width,
  }
  const t = createJBrowseTheme(theme)
  for (const feature of hview.features || []) {
    const strand = feature.get('strand') || 1
    const start = strand === 1 ? feature.get('start') : feature.get('end')
    const end = strand === 1 ? feature.get('end') : feature.get('start')
    const refName = feature.get('refName')
    const mate = feature.get('mate')
    const mateRef = mate.refName

    let r = 'black'
    if (colorBy === 'identity') {
      const identity = feature.get('identity')
      for (let i = 0; i < thresholds.length; i++) {
        if (identity > +thresholds[i]) {
          r = palette[i] || 'black'
          break
        }
      }
    } else if (colorBy === 'meanQueryIdentity') {
      r = `hsl(${feature.get('meanScore') * 200},100%,40%)`
    } else if (colorBy === 'mappingQuality') {
      r = `hsl(${feature.get('mappingQual')},100%,40%)`
    } else if (colorBy === 'strand') {
      r = strand === -1 ? negColor : posColor
    } else if (colorBy === 'default') {
      r = isCallback
        ? readConfObject(config, 'color', { feature })
        : color === '#f0f'
          ? t.palette.text.primary
          : color
    }
    ctx.fillStyle = r
    ctx.strokeStyle = r

    const b10 = bpToPx({ self: hsnap, refName, coord: start })
    const b20 = bpToPx({ self: hsnap, refName, coord: end })
    const e10 = bpToPx({ self: vsnap, refName: mateRef, coord: mate.start })
    const e20 = bpToPx({ self: vsnap, refName: mateRef, coord: mate.end })
    if (
      b10 !== undefined &&
      b20 !== undefined &&
      e10 !== undefined &&
      e20 !== undefined
    ) {
      const b1 = b10.offsetPx - db1!
      const b2 = b20.offsetPx - db1!
      const e1 = e10.offsetPx - db2!
      const e2 = e20.offsetPx - db2!
      if (Math.abs(b1 - b2) <= 4 && Math.abs(e1 - e2) <= 4) {
        drawCir(ctx, b1, height - e1, lineWidth)
      } else {
        let currX = b1
        let currY = e1
        const cigar = feature.get('CIGAR')
        if (drawCigar && cigar) {
          const cigarOps = parseCigar(cigar)

          ctx.beginPath()
          ctx.moveTo(currX, height - currY)

          let lastDrawnX = currX
          let lastDrawnY = currX
          for (let i = 0; i < cigarOps.length; i += 2) {
            const val = +cigarOps[i]!
            const op = cigarOps[i + 1]!
            if (op === 'M' || op === '=' || op === 'X') {
              currX += (val / hBpPerPx) * strand
              currY += val / vBpPerPx
            } else if (op === 'D' || op === 'N') {
              currX += (val / hBpPerPx) * strand
            } else if (op === 'I') {
              currY += val / vBpPerPx
            }
            currX = clampWithWarnX(currX, b1, b2, feature)
            currY = clampWithWarnY(currY, e1, e2, feature)

            // only draw a line segment if it is bigger than 0.5px
            if (
              Math.abs(currX - lastDrawnX) > 0.5 ||
              Math.abs(currY - lastDrawnY) > 0.5
            ) {
              ctx.lineTo(currX, height - currY)
              lastDrawnX = currX
              lastDrawnY = currY
            }
          }

          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.moveTo(b1, height - e1)
          ctx.lineTo(b2, height - e2)
          ctx.stroke()
        }
      }
    } else {
      if (warnings.length <= 5) {
        if (b10 === undefined || b20 === undefined) {
          warnings.push({
            message: `feature at (X ${refName}:${start}-${end}) not plotted, fell outside of range`,
            effect: 'feature not rendered',
          })
        } else {
          warnings.push({
            message: `feature at (Y ${mateRef}:${mate.start}-${mate.end}) not plotted, fell outside of range`,
            effect: 'feature not rendered',
          })
        }
      }
    }
  }

  return { warnings }
}
