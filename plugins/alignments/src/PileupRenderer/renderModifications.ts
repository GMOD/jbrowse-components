import { bpSpanPx, Region } from '@jbrowse/core/util'
import {
  getModificationPositions,
  getModificationProbabilities,
  getNextRefPos,
  parseCigar,
} from '../MismatchParser'
import { getTagAlt } from '../util'
import { fillRect, LayoutFeature } from './util'
import { RenderArgsWithColor } from './makeImageData'
import { colord } from '@jbrowse/core/util/colord'

// render modifications stored in MM tag in BAM
//
// ML stores probabilities as array of numerics and MP is scaled phred scores
// https://github.com/samtools/hts-specs/pull/418/files#diff-e765c6479316309f56b636f88189cdde8c40b854c7bdcce9ee7fe87a4e76febcR596
//
// if we have ML or Ml, it is an 8bit probability, divide by 255
//
// if we have MP or Mp it is phred scaled ASCII, which can go up to 90 but
// has very high likelihood basecalls at that point, we really only care
// about low qual calls <20 approx
export function renderModifications({
  ctx,
  feat,
  region,
  bpPerPx,
  renderArgs,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  renderArgs: RenderArgsWithColor
  canvasWidth: number
}) {
  const { feature, topPx, heightPx } = feat
  const { modificationTagMap = {} } = renderArgs

  const seq = feature.get('seq') as string | undefined

  if (!seq) {
    return
  }
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
  const cigar = feature.get('CIGAR')
  const start = feature.get('start')
  const strand = feature.get('strand')
  const cigarOps = parseCigar(cigar)
  const probabilities = getModificationProbabilities(feature)
  const modifications = getModificationPositions(mm, seq, strand)

  // probIndex applies across multiple modifications e.g.
  let probIndex = 0
  for (const { type, positions } of modifications) {
    const col = modificationTagMap[type] || 'black'
    const base = colord(col)
    for (const readPos of getNextRefPos(cigarOps, positions)) {
      const r = start + readPos
      const [leftPx, rightPx] = bpSpanPx(r, r + 1, region, bpPerPx)
      const prob = probabilities?.[probIndex] || 0
      const c = prob !== 1 ? base.alpha(prob + 0.1).toHslString() : col
      const w = rightPx - leftPx + 0.5
      fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      probIndex++
    }
  }
}
