import { isWithinReadBand } from '../../shared/hitTestTypes.ts'
import { readIdAt } from '../../shared/readIdentity.ts'
import { findMarkAt } from '../mark.ts'
import { SOFTCLIP_BASES_MARK } from './mark.ts'

import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

// The read behind a drawn soft-clip base cell.
//
// `readPositions` carries the read's TRUE aligned extent — the soft-clip
// expansion is applied to the layout's extents only, never written back — so
// `hitTestFeature` finds nothing over the clipped tail even though
// `drawSoftclipBases` paints a full-height cell per clipped base there. Without
// this the visible clipped run answered no hover, cleared the selection on
// click, and fell through to the browser's own context menu on right-click.
//
// Answers the READ, like `hitTestFeature`: the cells are that read's unaligned
// tail, so the tooltip/details/menu should describe it. The clip itself is
// already reachable — `hitTestClip` covers the bar at the alignment edge, and
// runs first.
//
// `softclipBasePositions` is empty unless `showSoftClipping` is on (the worker
// builds it from `showSoftClipping ? softclips : []`), so this needs no gate of
// its own: with the setting off there is nothing to hit. The cell, the row scan
// and its `basePos` pivot are the mark's; the band guard is not, because it is a
// question about the pileup rather than about this mark.
export function hitTestSoftclipBase(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
): { id: string; index: number } | undefined {
  const data = resolved.rpcData
  const i = isWithinReadBand(coords, featureHeight)
    ? findMarkAt(SOFTCLIP_BASES_MARK, data, coords, false)
    : undefined
  const readIdx = i === undefined ? undefined : data.softclipBaseReadIndices[i]!
  const id = readIdx === undefined ? undefined : readIdAt(data, readIdx)
  return id === undefined || readIdx === undefined
    ? undefined
    : { id, index: readIdx }
}
