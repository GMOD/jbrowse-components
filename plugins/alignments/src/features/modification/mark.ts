import { defineMark } from '@jbrowse/render-core/marks'

import * as packedColorQuadShader from '../../shaders/slang/packedColorQuad.generated.ts'
import { packColorCells } from '../perBaseQuality/mark.ts'
import { Band, Fade, Hit, Paint, pileupShape } from '../pileupShape.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
import type { ModificationUploadData } from './types.ts'

const identity = (packed: number) => packed

// One base modification call: a `cell` mark on one pileup row, coloured by the
// ABGR the worker packed. Same pivot as `MISMATCH_MARK` and for the shader's own
// reason — packedColorQuad.slang measures `pileupCellX`, the anchored cell span
// mismatch.slang measures, because the two passes paint over each other and a
// modification cell widened about its midpoint sat a column left of the mismatch
// cell on the same base.
//
// Opaque on both backends: packedColorQuad.slang has no fade of any kind, and
// the call's confidence is carried in the COLOUR the worker packed. Its hit test
// is NOT this shape's: `hitTestModification` is a Flatbush nearest-neighbour
// query, which answers out of Hilbert order and picks by distance where every
// mark scan walks rows backwards.
export const MODIFICATION_MARK = defineMark({
  shape: pileupShape({
    id: 'modification',
    mod: packedColorQuadShader,
    pack: c => packColorCells(c, identity),
    pivot: 'cell',
    fade: Fade.opaque,
    hit: Hit.always,
    band: Band.row,
    // Modifications are sparse along a read — one per CpG on a nanopore pileup
    // — so no seam fudge; the base WALLS are the layers that take it.
    contiguous: false,
    // The worker's own packed colour, which is not a small table — 5mC, 5hmC
    // and the unmodified blue in per-read runs — so the painter reformats it
    // per run rather than per mark.
    paint: () => ({ rule: Paint.packedAbgr, opaqueCss: [], fadedCss: [] }),
  }),
  channels: (data: ModificationUploadData): PileupChannels => ({
    positions: data.modificationPositions,
    stride: 1,
    rows: data.modificationYs,
    start: 0,
    end: data.modificationYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
    keys: data.modificationColors,
  }),
  params: (state: RenderState) => state,
  enabled: s => s.showModifications,
})
