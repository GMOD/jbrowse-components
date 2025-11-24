import { bpSpanPx, max, sum } from '@jbrowse/core/util'

import { getNextRefPos } from '../../MismatchParser'
import { getModPositions } from '../../ModificationParser/getModPositions'
import { getModProbabilities } from '../../ModificationParser/getModProbabilities'
import { getMaxProbModAtEachPosition } from '../../shared/getMaximumModificationAtEachPosition'
import { getModificationName } from '../../shared/modificationData'
import { alphaColor } from '../../shared/util'
import { getTagAlt } from '../../util'
import { fillRect } from '../util'

import type { FlatbushItem, ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

// Pre-compute colord object for blue color (used in two-color mode)
const BLUE_COLORD = 'blue'

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
  cigarOps: number[]
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
  const modificationThreshold = colorBy?.modifications?.threshold ?? 10
  const thresholdFraction = modificationThreshold / 100
  const bottomPx = topPx + heightPx

  // Get all modifications with strand info for tooltip
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
  const modifications = getModPositions(mm, seq, fstrand)
  const probabilities = getModProbabilities(feature)

  // Build a map of position -> list of modifications with strand info
  const modsByPosition = new Map<
    number,
    { type: string; base: string; strand: string; prob: number }[]
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

      // Check if modification probability exceeds threshold
      if (prob < thresholdFraction) {
        return
      }

      const widthPx = rightPx - leftPx + 0.5
      const col = mod.color || 'black'
      const s = 1 - sum(allProbs)
      const maxProb = max(allProbs)
      if (twoColor && s > maxProb) {
        const c = alphaColor(BLUE_COLORD, s)
        fillRect(ctx, leftPx, topPx, widthPx, heightPx, canvasWidth, c)
      } else {
        const c = alphaColor(col, prob)
        fillRect(ctx, leftPx, topPx, widthPx, heightPx, canvasWidth, c)
      }

      // Add to flatbush for mouseover with strand-specific info showing all modifications
      const modsAtPos = modsByPosition.get(pos)
      if (rightPx - leftPx >= 0.2 && modsAtPos) {
        items.push({
          type: 'modification',
          seq: modsAtPos
            .map(
              m =>
                `${m.base}${m.strand}${m.type} ${getModificationName(m.type)} (${(m.prob * 100).toFixed(1)}%)`,
            )
            .join('<br/>'),
          modType: type,
          probability: prob,
        })
        coords.push(leftPx, topPx, rightPx, bottomPx)
      }

      pos++
    },
  )

  return { coords, items }
}
