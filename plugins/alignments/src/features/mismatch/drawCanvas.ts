import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  frequencyFade,
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { qualityFade } from '../../shaders/slang/mismatch.js.generated.ts'
import { buildBaseCssMap, buildBaseTupleMap } from './baseColors.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { MismatchUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawMismatches(
  ctx: Ctx2D,
  region: MismatchUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const pxPerBp = fullBlockWidth / bpLength
  const { cellX, w } = makePileupCellMapper(
    block,
    bpLength,
    fullBlockWidth,
    false,
  )
  // N has a palette entry; any other non-A/C/G/T byte takes the fallback,
  // matching the GPU shader (mismatch.slang baseColor catch-all). Opaque
  // mismatches — the common case once zoomed to base level, where both fades
  // resolve to 1 — read a prebuilt CSS string instead of formatting one per
  // mismatch; only a genuinely faded one pays `rgba255`.
  const baseCss = buildBaseCssMap(state)
  const baseTuples = buildBaseTupleMap(state)

  for (let i = 0; i < region.mismatchPositions.length; i++) {
    const yRow = region.mismatchYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const x = cellX(region.mismatchPositions[i]!)
    const base = region.mismatchBases[i]!
    const freqAlpha = frequencyFade(
      state,
      pxPerBp,
      region.mismatchFrequencies[i]!,
    )
    // Fade by base quality: Phred 50+ opaque, lower fades out, and
    // QUAL_UNAVAILABLE (the read reports none) stays opaque. Phred 0 is a score
    // and fades all the way — it used to share the sentinel's value.
    // `qualityFade` is mismatch.slang's own ramp, generated into TS (adr-051).
    const alpha =
      freqAlpha * qualityFade(region.mismatchQuals[i]!, state.mismatchAlpha)
    ctx.fillStyle =
      alpha >= 1 ? baseCss[base]! : rgba255(baseTuples[base]!, alpha)
    ctx.fillRect(x, y, w, fH)
  }
}
