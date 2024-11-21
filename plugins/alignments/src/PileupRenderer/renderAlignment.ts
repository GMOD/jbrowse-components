import { LayoutFeature } from './util'

import { getAlignmentShapeColor } from './getAlignmentShapeColor'
import { renderAlignmentShape } from './renderAlignmentShape'
import { renderPerBaseQuality } from './renderPerBaseQuality'
import { renderPerBaseLettering } from './renderPerBaseLettering'
import { renderModifications } from './renderModifications'
import { RenderArgsWithColor } from './makeImageData'
import { renderMethylation } from './renderMethylation'
import { parseCigar } from '../MismatchParser'

export function renderAlignment({
  ctx,
  feat,
  renderArgs,
  colorForBase,
  contrastForBase,
  charWidth,
  charHeight,
  defaultColor,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: RenderArgsWithColor
  colorForBase: Record<string, string>
  contrastForBase: Record<string, string>
  charWidth: number
  charHeight: number
  defaultColor: boolean
  canvasWidth: number
}) {
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

  renderAlignmentShape({ ctx, feat, renderArgs })

  // second pass for color types that render per-base things that go over the
  // existing drawing
  switch (colorType) {
    case 'perBaseQuality': {
      const cigarOps = parseCigar(feature.get('CIGAR'))
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
      const cigarOps = parseCigar(feature.get('CIGAR'))
      renderPerBaseLettering({
        ctx,
        feat,
        region,
        bpPerPx,
        colorForBase,
        contrastForBase,
        charWidth,
        charHeight,
        canvasWidth,
        cigarOps,
      })
      break
    }

    case 'modifications': {
      const cigarOps = parseCigar(feature.get('CIGAR'))
      renderModifications({
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

    case 'methylation': {
      const cigarOps = parseCigar(feature.get('CIGAR'))
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
}
