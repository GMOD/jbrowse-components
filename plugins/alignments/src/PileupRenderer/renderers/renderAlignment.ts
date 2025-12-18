import { getCigarOps } from './cigarUtil'
import { getAlignmentShapeColor } from './getAlignmentShapeColor'
import { renderAlignmentShape } from './renderAlignmentShape'
import { renderMethylation } from './renderMethylation'
import { renderModifications } from './renderModifications'
import { renderPerBaseLettering } from './renderPerBaseLettering'
import { renderPerBaseQuality } from './renderPerBaseQuality'

import type { FlatbushItem, ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'

function collectResults(
  ret: { coords: number[]; items: FlatbushItem[] },
  coords: number[],
  items: FlatbushItem[],
) {
  for (let i = 0, l = ret.coords.length; i < l; i++) {
    coords.push(ret.coords[i]!)
  }
  for (let i = 0, l = ret.items.length; i < l; i++) {
    items.push(ret.items[i]!)
  }
}

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

  const alignmentColor = getAlignmentShapeColor({
    feature,
    config,
    tag,
    defaultColor,
    colorType,
    colorTagMap,
  })
  const cigarOps = getCigarOps(
    feature.get('NUMERIC_CIGAR') || feature.get('CIGAR'),
  )
  renderAlignmentShape({
    ctx,
    feat,
    renderArgs,
    canvasWidth,
    color: alignmentColor,
    cigarOps,
  })

  // second pass for color types that render per-base things that go over the
  // existing drawing
  switch (colorType) {
    case 'perBaseQuality': {
      renderPerBaseQuality({
        ctx,
        feat,
        region,
        bpPerPx,
        cigarOps,
      })
      break
    }

    case 'perBaseLettering': {
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
      collectResults(
        renderModifications({
          ctx,
          feat,
          region,
          bpPerPx,
          renderArgs,
          cigarOps,
        }),
        coords,
        items,
      )
      break
    }

    case 'methylation': {
      collectResults(
        renderMethylation({ ctx, feat, region, bpPerPx, renderArgs, cigarOps }),
        coords,
        items,
      )
      break
    }
  }

  return { coords, items }
}
