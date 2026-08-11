import {
  findTopmostOnRow,
  isWithinReadBand,
} from '../../shared/hitTestTypes.ts'

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
// its own: with the setting off there is nothing to hit.
export function hitTestSoftclipBase(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
): { id: string; index: number } | undefined {
  const { basePos, row } = coords
  if (!isWithinReadBand(coords, featureHeight)) {
    return undefined
  }
  const { softclipBasePositions, softclipBaseYs, softclipBaseReadIndices } =
    resolved.rpcData
  // Topmost, not first: see `findTopmostOnRow`. Cells are one bp wide, so the
  // match indexes a base — `basePos`, not the fractional `genomicPos` (see
  // canvasXToBasePos).
  const i = findTopmostOnRow(
    softclipBaseYs,
    0,
    softclipBasePositions.length,
    row,
    i => softclipBasePositions[i] === basePos,
  )
  if (i === undefined) {
    return undefined
  }
  const readIdx = softclipBaseReadIndices[i]!
  const id = resolved.rpcData.readIds[readIdx]
  return id === undefined ? undefined : { id, index: readIdx }
}
