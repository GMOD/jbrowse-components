import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { parseCigar2 } from '@jbrowse/plugin-alignments'
import { when } from 'mobx'

import {
  LABEL_FONT_MAX,
  LABEL_WIDTH,
} from './components/multiSyntenyBackendTypes.ts'
import {
  drawCigarOps,
  drawCsOps,
  getFeatureColor,
} from './components/multiSyntenyColorUtils.ts'

import type { MultiLGVSyntenyDisplayModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(model: MultiLGVSyntenyDisplayModel) {
  const view = getContainingView(model) as LGV
  await when(() => model.genomeRows.size > 0 || !!model.error)

  const { genomeRows, displayedGenomes, colorBy, height, rowHeight, showSnps } =
    model
  const { width, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  if (genomeRows.size === 0) {
    return null
  }

  const ctx = new SvgCanvas()
  const bpToPx = (refName: string, coord: number) => {
    const result = view.bpToPx({ refName, coord })
    if (result === undefined) {
      return undefined
    }
    return result.offsetPx - offsetPx
  }

  ctx.fillStyle = '#ededed'
  ctx.fillRect(0, 0, width, height)

  for (let g = 0; g < displayedGenomes.length; g++) {
    const genomeName = displayedGenomes[g]!
    const y = g * rowHeight
    const features = genomeRows.get(genomeName) ?? []

    if (g % 2 === 0) {
      ctx.fillStyle = '#f8f8f8'
      ctx.fillRect(0, y, width, rowHeight)
    }

    if (labelW > 0) {
      ctx.fillStyle = '#333'
      ctx.font = `${Math.min(rowHeight - 4, LABEL_FONT_MAX)}px sans-serif`
      ctx.textBaseline = 'middle'
      const displayName =
        genomeName.length > 15 ? `${genomeName.slice(0, 12)}...` : genomeName
      ctx.fillText(displayName, 4, y + rowHeight / 2)
    }

    const padding = rowHeight >= 6 ? 1 : 0
    for (const feat of features) {
      const px1 = bpToPx(feat.origRefName, feat.start)
      const px2 = bpToPx(feat.origRefName, feat.end)
      if (px1 === undefined || px2 === undefined) {
        continue
      }
      const x1 = px1 + labelW
      const x2 = px2 + labelW
      const blockWidth = Math.max(x2 - x1, 1)

      if (x1 + blockWidth < labelW || x1 > width) {
        continue
      }

      const clippedX = Math.max(x1, labelW)
      const clippedW = Math.min(blockWidth, width - clippedX)
      const fy = y + padding
      const fh = rowHeight - padding * 2

      ctx.fillStyle = getFeatureColor(feat, colorBy)
      ctx.fillRect(clippedX, fy, clippedW, fh)

      if (showSnps) {
        const bpLen = feat.end - feat.start
        if (feat.cs) {
          drawCsOps(ctx, feat.cs, x1, fy, blockWidth, fh, bpLen)
        } else if (feat.cigar) {
          drawCigarOps(
            ctx,
            parseCigar2(feat.cigar),
            x1,
            fy,
            blockWidth,
            fh,
            bpLen,
          )
        }
      }
    }

    if (rowHeight >= 4) {
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + rowHeight)
      ctx.lineTo(width, y + rowHeight)
      ctx.stroke()
    }
  }

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
}
