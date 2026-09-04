import {
  chevronCapsEdge,
  chevronContains,
} from '../../shaders/slang/readChevron.js.generated.ts'
import {
  findTopmostOnRow,
  isWithinReadBand,
} from '../../shared/hitTestTypes.ts'
import { readIdAt } from '../../shared/readIdentity.ts'
import { showChevron } from './drawCanvas.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { ChevronFrame } from './drawCanvas.ts'

function firstSegmentOf(segmentReadIndices: Uint32Array, read: number) {
  let lo = 0
  let hi = segmentReadIndices.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (segmentReadIndices[mid]! < read) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// The arrowhead is ink the body's bp span does not cover: it protrudes
// CHEVRON_PX past the capped edge. Same predicate the shader's geometry is
// built from (readChevron.slang), asked in bp so a reversed region needs no
// case of its own, and gated by the same `showChevron` the two painters use.
function chevronContainsCursor(
  data: PileupDataResult,
  read: number,
  coords: CigarCoords,
  frame: ChevronFrame,
) {
  const {
    segmentReadIndices,
    segmentEdgeFlags,
    segmentPositions,
    readStrands,
    readFlags,
    readInterchrom,
    readInsertSizes,
  } = data
  const strand = readStrands[read]!
  const dyPx = coords.yWithinRow - frame.featureHeight / 2
  let inside = false
  for (
    let s = firstSegmentOf(segmentReadIndices, read);
    !inside && s < segmentReadIndices.length && segmentReadIndices[s] === read;
    s++
  ) {
    const capsEdge = chevronCapsEdge(strand, segmentEdgeFlags[s]!)
    if (capsEdge !== 0) {
      const start = segmentPositions[s * 2]!
      const end = segmentPositions[s * 2 + 1]!
      const dxPx =
        (capsEdge > 0 ? coords.genomicPos - end : start - coords.genomicPos) *
        frame.pxPerBp
      inside =
        chevronContains(dxPx, dyPx, frame.featureHeight) &&
        showChevron(
          frame,
          readFlags[read]!,
          readInterchrom[read]!,
          readInsertSizes[read]!,
          (end - start) * frame.pxPerBp,
        )
    }
  }
  return inside
}

export function hitTestFeature(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  chevrons: ChevronFrame,
): { id: string; index: number } | undefined {
  const { genomicPos, row } = coords
  if (!isWithinReadBand(coords, chevrons.featureHeight)) {
    return undefined
  }
  const { rpcData } = resolved
  const { readPositions, readYs, readKeys } = rpcData
  // Topmost, not first: see `findTopmostOnRow`. This is the read every mark
  // hit test is reconciled against, so it and they must use the one rule.
  const i = findTopmostOnRow(readYs, 0, readKeys.length, row, i => {
    const readStart = readPositions[i * 2]
    const readEnd = readPositions[i * 2 + 1]
    return (
      readStart !== undefined &&
      readEnd !== undefined &&
      ((genomicPos >= readStart && genomicPos <= readEnd) ||
        chevronContainsCursor(rpcData, i, coords, chevrons))
    )
  })
  return i === undefined ? undefined : { id: readIdAt(rpcData, i)!, index: i }
}
