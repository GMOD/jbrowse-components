import { bpSpanPx, max, sum } from '@jbrowse/core/util'

import { getMaxProbModAtEachPosition } from '../../shared/getMaximumModificationAtEachPosition'
import { getModPositions } from '../../ModificationParser/getModPositions'
import { getModProbabilities } from '../../ModificationParser/getModProbabilities'
import { getNextRefPos } from '../../MismatchParser'
import { alphaColor } from '../../shared/util'
import { getTagAlt } from '../../util'
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

  // Get all modifications with strand info for tooltip
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
  const modifications = getModPositions(mm, seq, fstrand)
  const probabilities = getModProbabilities(feature)

  // Build a map of position -> list of modifications with strand info
  const modsByPosition = new Map<
    number,
    Array<{ type: string; base: string; strand: string; prob: number }>
  >()

  let probIndex = 0
  for (const { type, base, strand, positions } of modifications) {
    for (const { ref, idx } of getNextRefPos(cigarOps, positions)) {
      const prob =
        probabilities?.[
          probIndex + (fstrand === -1 ? positions.length - 1 - idx : idx)
        ] || 0

      if (!modsByPosition.has(ref)) {
        modsByPosition.set(ref, [])
      }
      modsByPosition.get(ref)!.push({ type, base, strand, prob })
    }
    probIndex += positions.length
  }

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
      if (twoColor && s > max(allProbs)) {
        const c = alphaColor('blue', s)
        const w = rightPx - leftPx + 0.5
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      } else {
        const c = alphaColor(col, prob)
        const w = rightPx - leftPx + 0.5
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      }

      // Add to flatbush for mouseover with strand-specific info
      const modsAtPos = modsByPosition.get(pos) || []
      const strandInfo = modsAtPos
        .map(m => `${m.base}${m.strand}${m.type} (${(m.prob * 100).toFixed(1)}%)`)
        .join(', ')

      items.push({
        type: 'modification',
        seq: strandInfo || mod.base,
        modType: type,
        probability: prob,
      })
      coords.push(leftPx, topPx, rightPx, topPx + heightPx)

      pos++
    },
  )

  return { coords, items }
}
