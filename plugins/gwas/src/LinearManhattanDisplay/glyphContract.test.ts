import { defaultGlyph } from '../ManhattanRPC/rpcTypes.ts'
import {
  GLYPH_INDEX,
  GLYPH_INSERTION,
  GLYPH_POINT,
} from './shaders/manhattan.consts.generated.ts'

import type { Feature } from '@jbrowse/core/util'

// The glyph ids are a numeric contract between the RPC executor, the LD
// evaluator, the Canvas2D/SVG draw and the shader's vertex branches. Drift
// makes the GPU draw different glyphs from the fallback and the export, with
// nothing throwing.
//
// This file used to enforce that by reading manhattan.slang and string-matching
// its branches (`inst.glyph == 1u ? SHAPE_TRI`). That pinned the *source text*,
// not the values: it broke on reformatting, and it could not have caught the
// worker and the shader agreeing on a spelling but disagreeing on a number.
// The ids are `//! export-consts`ed now (adr-051) and there is only one
// definition left, so there is no longer a pair to compare. What remains worth
// asserting is the shape of that one definition, and the classifier over it.

test('the three glyph classes stay distinct', () => {
  // A renumbering that collapsed two would merge glyph classes rather than
  // fail — every insertion SV would quietly draw as a plain SNP, say.
  expect(new Set([GLYPH_POINT, GLYPH_INSERTION, GLYPH_INDEX]).size).toBe(3)
})

test('defaultGlyph sends insertion SVs to the triangle and the rest to a disc', () => {
  // Both coloring modes route through this, so an SV cannot flatten into a
  // plain disc just because LD mode is off.
  const feat = (svtype?: string) =>
    ({ get: (k: string) => (k === 'svtype' ? svtype : undefined) }) as Feature
  expect(defaultGlyph(feat('INS'))).toBe(GLYPH_INSERTION)
  expect(defaultGlyph(feat('DEL'))).toBe(GLYPH_POINT)
  expect(defaultGlyph(feat())).toBe(GLYPH_POINT)
})
