import { bpSpanPx, max, sum } from '@jbrowse/core/util'

import { getMaxProbModAtEachPosition } from '../../shared/getMaximumModificationAtEachPosition'
import { getModificationName } from '../../shared/modificationData'
import { alphaColor } from '../../shared/util'
import { fillRect } from '../util'

import type { FlatbushItem, ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

// render modifications stored in MM tag in BAM
export function renderModifications({
  ctx,
  feat,
  region,
  bpPerPx,
  renderArgs,
  canvasWidth,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  renderArgs: ProcessedRenderArgs
  canvasWidth: number
  cigarOps: string[]
}) {
  const items = [] as FlatbushItem[]
  const coords = [] as number[]
  const { feature, topPx, heightPx } = feat
  const { colorBy, visibleModifications = {} } = renderArgs

  const seq = feature.get('seq') as string | undefined

  if (!seq) {
    return { coords, items }
  }
  const start = feature.get('start')
  const isolatedModification = colorBy?.modifications?.isolatedModification
  const twoColor = colorBy?.modifications?.twoColor

  // Get the feature strand for strand-specific tooltip info
  const fstrand = feature.get('strand') as -1 | 0 | 1

  // this is a hole-y array, does not work with normal for loop
  // eslint-disable-next-line unicorn/no-array-for-each
  getMaxProbModAtEachPosition(feature, cigarOps)?.forEach(
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
      const isNonmod = twoColor && s > max(allProbs)
      if (isNonmod) {
        const c = alphaColor('blue', s)
        const w = rightPx - leftPx + 0.5
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      } else {
        const c = alphaColor(col, prob)
        const w = rightPx - leftPx + 0.5
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      }

      // Build tooltip showing only the max probability modification
      const modName = getModificationName(type)
      const strandSymbol = fstrand === 1 ? '+' : fstrand === -1 ? '-' : ''
      const displayProb = isNonmod ? s : prob
      const prefix = isNonmod ? 'Non-modified ' : ''
      const strandInfo = `${prefix}${mod.base}${strandSymbol}${type} ${modName} (${(displayProb * 100).toFixed(1)}%)`

      items.push({
        type: 'modification',
        seq: strandInfo,
        modType: type,
        probability: displayProb,
      })
      coords.push(leftPx, topPx, rightPx, topPx + heightPx)

      pos++
    },
  )

  return { coords, items }
}
