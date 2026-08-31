import type { PileupMark } from '../mark.ts'
import type { ModificationUploadData } from './types.ts'

// One base modification call: a `cell` mark on one pileup row, coloured by the
// ABGR the worker packed. Same pivot as `MISMATCH_MARK` and for the shader's own
// reason — packedColorQuad.slang measures `pileupCellX`, the anchored cell span
// mismatch.slang measures, because the two passes paint over each other and a
// modification cell widened about its midpoint sat a column left of the mismatch
// cell on the same base.
//
// Its hit test is NOT `findMarkAt`: `hitTestModification` is a Flatbush
// nearest-neighbour query, which answers out of Hilbert order and picks by
// distance where every mark scan walks rows backwards. See
// agent-docs/ideas/one-mark-declaration-per-feature.md.
export const MODIFICATION_MARK: PileupMark<ModificationUploadData> = {
  shape: 'cell',
  rows: data => data.modificationYs,
  startBp: (data, i) => data.modificationPositions[i]!,
  endBp: (data, i) => data.modificationPositions[i]! + 1,
  selects: () => true,
  // Opaque, always, on both backends: packedColorQuad.slang has no fade of any
  // kind. The call's confidence is carried in the COLOUR the worker packed —
  // `unpackRGBA` reads its alpha byte straight out of the instance — so a mark
  // this pass draws at all, it draws at whatever that byte says.
  alpha: () => 1,
  // Stated rather than omitted: the Flatbush query above is what decides which
  // call a click lands on, and it has no significance threshold of its own.
  hittable: () => true,
  canvas2d: {
    // Modifications are sparse along a read — one per CpG on a nanopore pileup —
    // so no seam fudge; the base WALLS are the layers that take it.
    contiguous: false,
    bandTop: (_data, _i, rowY) => rowY,
    bandHeight: (_data, _i, featureHeight) => featureHeight,
  },
}
