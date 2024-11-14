import type { Region } from '@jbrowse/core/util'
import { bpSpanPx, max, sum } from '@jbrowse/core/util'

// locals
import { fillRect, LayoutFeature } from './util'
import { RenderArgsWithColor } from './makeImageData'
import { alphaColor } from '../shared/util'
import { MaxProbMod } from '../shared/getMaxProbModAtEachPosition'

// render modifications stored in MM tag in BAM
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
  const { colorBy, visibleModifications = {} } = renderArgs

  const seq = feature.get('seq') as string | undefined

  if (!seq) {
    return
  }
  const start = feature.get('start')
  const isolatedModification = colorBy?.modifications?.isolatedModification
  const twoColor = colorBy?.modifications?.twoColor

  ;(feature.get('modifications') as MaxProbMod[] | undefined)?.forEach(
    ({ allProbs, prob, type }, pos) => {
      const r = start + pos
      const [leftPx, rightPx] = bpSpanPx(r, r + 1, region, bpPerPx)
      const mod = visibleModifications[type]
      if (!mod) {
        console.warn(`${type} not known yet`)
        return
      }
      if (isolatedModification && mod.type !== isolatedModification) {
        return
      }
      const col = mod.color || 'black'
      const s = 1 - sum(allProbs)
      if (twoColor && s > max(allProbs)) {
        const c = alphaColor('blue', s)
        const w = rightPx - leftPx + 0.5
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      } else {
        const c = alphaColor(col, prob)
        const w = rightPx - leftPx + 0.5
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      }
    },
  )
}
