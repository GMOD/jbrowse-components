import { bpSpanPx, max, sum } from '@jbrowse/core/util'

import { getNextRefPos } from '../../MismatchParser'
import { getModPositions } from '../../ModificationParser/getModPositions'
import { getModProbabilities } from '../../ModificationParser/getModProbabilities'
import { getMaxProbModAtEachPosition } from '../../shared/getMaxProbModAtEachPosition'
import { getModificationName } from '../../shared/modificationData'
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
  const modificationThreshold = colorBy?.modifications?.threshold ?? 10
  const thresholdFraction = modificationThreshold / 100

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
  const modLen = modifications.length
  for (let i = 0; i < modLen; i++) {
    const mod = modifications[i]
    const nextRefPosArray = getNextRefPos(cigarOps, mod.positions)
    const nextRefPosLen = nextRefPosArray.length
    const posLen = mod.positions.length

    for (let j = 0; j < nextRefPosLen; j++) {
      const item = nextRefPosArray[j]
      const prob =
        probabilities?.[
          probIndex + (fstrand === -1 ? posLen - 1 - item.idx : item.idx)
        ] || 0

      if (!modsByPosition.has(item.ref)) {
        modsByPosition.set(item.ref, [])
      }
      modsByPosition.get(item.ref)!.push({
        type: mod.type,
        base: mod.base,
        strand: mod.strand,
        prob,
      })
    }
    probIndex += posLen
  }

  // Get modifications as a Map of position -> modification info
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

      const col = mod.color || 'black'
      const w = rightPx - leftPx + 0.5
      const s = 1 - sum(allProbs)
      const allProbsMax = max(allProbs)
      if (twoColor && s > allProbsMax) {
        const c = alphaColor('blue', s)
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      } else {
        const c = alphaColor(col, prob)
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      }

      // Add to flatbush for mouseover with strand-specific info showing all modifications
      const modsAtPos = modsByPosition.get(pos) || []
      const modsPosLen = modsAtPos.length
      let strandInfo = ''
      for (let i = 0; i < modsPosLen; i++) {
        const m = modsAtPos[i]
        if (i > 0) {
          strandInfo += '<br/>'
        }
        strandInfo += `${m.base}${m.strand}${m.type} ${getModificationName(m.type)} (${(m.prob * 100).toFixed(1)}%)`
      }

      items.push({
        type: 'modification',
        seq: strandInfo || mod.base,
        modType: type,
        probability: prob,
      })
      coords.push(leftPx, topPx, rightPx, topPx + heightPx)
    },
  )

  return { coords, items }
}
