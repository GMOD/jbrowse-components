import { getAlignmentShapeColor } from './getAlignmentShapeColor'
import { renderAlignmentShape } from './renderAlignmentShape'
import { renderMethylation } from './renderMethylation'
import { renderModifications } from './renderModifications'
import { renderPerBaseLettering } from './renderPerBaseLettering'
import { renderPerBaseQuality } from './renderPerBaseQuality'
import { parseCigar2 } from '../../MismatchParser'

import type { FlatbushItem, ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'

export function renderAlignment({
  ctx,
  feat,
  renderArgs,
  colorMap,
  colorContrastMap,
  charWidth,
  charHeight,
  defaultColor,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: ProcessedRenderArgs
  colorMap: Record<string, string>
  colorContrastMap: Record<string, string>
  charWidth: number
  charHeight: number
  defaultColor: boolean
  canvasWidth: number
}) {
  const items = [] as FlatbushItem[]
  const coords = [] as number[]
  const { config, bpPerPx, regions, colorBy, colorTagMap = {} } = renderArgs
  const { tag = '', type: colorType = '' } = colorBy || {}
  const { feature } = feat
  const region = regions[0]!

  ctx.fillStyle = getAlignmentShapeColor({
    feature,
    config,
    tag,
    defaultColor,
    colorType,
    colorTagMap,
  })

  renderAlignmentShape({ ctx, feat, renderArgs, canvasWidth })

  // second pass for color types that render per-base things that go over the
  // existing drawing
  switch (colorType) {
    case 'perBaseQuality': {
      const cigarOps = parseCigar2(feature.get('CIGAR'))
      renderPerBaseQuality({
        ctx,
        feat,
        region,
        bpPerPx,
        canvasWidth,
        cigarOps,
      })
      break
    }

    case 'perBaseLettering': {
      const cigarOps = parseCigar2(feature.get('CIGAR'))
      renderPerBaseLettering({
        ctx,
        feat,
        region,
        bpPerPx,
        colorMap,
        colorContrastMap,
        charWidth,
        charHeight,
        canvasWidth,
        cigarOps,
      })
      break
    }

    case 'modifications': {
      const cigarOps = parseCigar2(feature.get('CIGAR'))
      const ret = renderModifications({
        ctx,
        feat,
        region,
        bpPerPx,
        renderArgs,
        canvasWidth,
        cigarOps,
      })
      for (let i = 0, l = ret.coords.length; i < l; i++) {
        coords.push(ret.coords[i]!)
      }
      for (let i = 0, l = ret.items.length; i < l; i++) {
        items.push(ret.items[i]!)
      }
      break
    }

    case 'methylation': {
      const cigarOps = parseCigar2(feature.get('CIGAR'))
      renderMethylation({
        ctx,
        feat,
        region,
        bpPerPx,
        renderArgs,
        canvasWidth,
        cigarOps,
      })
      break
    }
  }

  return { coords, items }
}
