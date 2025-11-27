import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { category10 } from '@jbrowse/core/ui/colors'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { colord } from '@jbrowse/core/util/colord'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { type Warning, clampWithWarnX, clampWithWarnY } from './clamp'

import type { Dotplot1DViewModel } from '../DotplotView/model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'

const { parseCigar } = MismatchParser

// Simple hash function to generate consistent colors for query names
function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Generate a color from a query name using the category10 color palette
function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

export interface DotplotRenderArgsDeserialized extends RenderArgsDeserialized {
  adapterConfig: AnyConfigurationModel
  height: number
  width: number
  highResolutionScaling: number
  alpha?: number
  minAlignmentLength?: number
  colorBy?: string
  view: {
    hview: Dotplot1DViewModel
    vview: Dotplot1DViewModel
  }
}

function applyAlpha(color: string, alpha: number) {
  // Skip colord processing if alpha is 1 (optimization)
  if (alpha === 1) {
    return color
  }
  return colord(color).alpha(alpha).toRgbString()
}

export async function drawDotplot(
  ctx: CanvasRenderingContext2D,
  props: DotplotRenderArgsDeserialized & { views: Dotplot1DViewModel[] },
) {
  const {
    config,
    views,
    height,
    drawCigar,
    theme,
    alpha = 1,
    minAlignmentLength = 0,
    colorBy: colorByOverride,
  } = props
  const color = readConfObject(config, 'color')
  const posColor = readConfObject(config, 'posColor')
  const negColor = readConfObject(config, 'negColor')
  // Use override if provided, otherwise fall back to config
  const colorBy = colorByOverride ?? readConfObject(config, 'colorBy')
  const lineWidth = readConfObject(config, 'lineWidth')
  const thresholds = readConfObject(config, 'thresholds')
  const palette = readConfObject(config, 'thresholdsPalette') as string[]
  const isCallback = config.color.isCallback
  const hview = views[0]!
  const vview = views[1]!
  const db1 = hview.dynamicBlocks.contentBlocks[0]?.offsetPx
  const db2 = vview.dynamicBlocks.contentBlocks[0]?.offsetPx
  const warnings = [] as Warning[]
  ctx.lineWidth = lineWidth

  // we operate on snapshots of these attributes of the hview/vview because
  // it is significantly faster than accessing the mobx objects
  const { bpPerPx: hBpPerPx } = hview
  const { bpPerPx: vBpPerPx } = vview

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
  const features = hview.features || []

  // Pre-compute colors with alpha for common cases (major optimization)
  let posColorWithAlpha: string | undefined
  let negColorWithAlpha: string | undefined
  let defaultColorWithAlpha: string | undefined

  // Cache for query colors with alpha applied
  const queryColorCache = new Map<string, string>()

  const getQueryColorWithAlpha = (queryName: string) => {
    if (!queryColorCache.has(queryName)) {
      const c = getQueryColor(queryName)
      queryColorCache.set(queryName, applyAlpha(c, alpha))
    }
    return queryColorCache.get(queryName)!
  }

  if (colorBy === 'strand') {
    // Pre-compute strand colors once instead of per-feature
    posColorWithAlpha = applyAlpha(posColor, alpha)
    negColorWithAlpha = applyAlpha(negColor, alpha)
  } else if (colorBy === 'default' && !isCallback) {
    // Pre-compute default color once instead of per-feature
    const c = color === '#f0f' ? t.palette.text.primary : color
    defaultColorWithAlpha = applyAlpha(c, alpha)
  }

  for (const feature of features) {
    // Cache feature properties to avoid repeated .get() calls (optimization)
    const strand = feature.get('strand') || 1
    const fStart = feature.get('start')
    const fEnd = feature.get('end')

    // Filter by minAlignmentLength if specified (inline for performance)
    if (minAlignmentLength > 0) {
      const alignmentLength = Math.abs(fEnd - fStart)
      if (alignmentLength < minAlignmentLength) {
        continue
      }
    }

    const refName = feature.get('refName')
    const mate = feature.get('mate')
    const mateRef = mate.refName

    // Calculate start/end based on strand using cached values
    const start = strand === 1 ? fStart : fEnd
    const end = strand === 1 ? fEnd : fStart

    let colorWithAlpha: string

    // Use pre-computed colors for common cases (major optimization)
    if (colorBy === 'strand') {
      // Use pre-computed colors (avoids applyAlpha call per feature)
      colorWithAlpha = strand === -1 ? negColorWithAlpha! : posColorWithAlpha!
    } else if (colorBy === 'query') {
      // Color by query sequence name
      const queryName = refName
      colorWithAlpha = getQueryColorWithAlpha(queryName)
    } else if (colorBy === 'default' && !isCallback) {
      // Use pre-computed color (avoids applyAlpha call per feature)
      colorWithAlpha = defaultColorWithAlpha!
    } else {
      // Calculate color dynamically for other modes
      let r = 'black'
      if (colorBy === 'identity') {
        const identity = feature.get('identity')
        // eslint-disable-next-line unicorn/no-for-loop
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
      } else if (colorBy === 'default' && isCallback) {
        r = readConfObject(config, 'color', { feature })
      }
      colorWithAlpha = applyAlpha(r, alpha)
    }

    ctx.fillStyle = colorWithAlpha
    ctx.strokeStyle = colorWithAlpha

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
        ctx.beginPath()
        ctx.arc(b1, height - e1, lineWidth / 2, 0, 2 * Math.PI)
        ctx.fill()
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
            currX = clampWithWarnX(currX, b1, b2, feature, warnings)
            currY = clampWithWarnY(currY, e1, e2, feature, warnings)

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
            message: `feature at (X-coord: ${refName}:${start}-${end}) not plotted, fell outside of range`,
            effect: 'feature not rendered',
          })
        } else {
          warnings.push({
            message: `feature at (Y-coord: ${mateRef}:${mate.start}-${mate.end}) not plotted, fell outside of range`,
            effect: 'feature not rendered',
          })
        }
      }
    }
  }

  return { warnings }
}
