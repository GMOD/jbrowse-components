import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  GLYPH_INDEX,
  GLYPH_INSERTION,
  GLYPH_POINT,
} from '../ManhattanRPC/rpcTypes.ts'
import { INDEX_GLYPH_SCALE } from './Canvas2DManhattanRenderer.ts'

// The GPU path duplicates two things the Canvas2D/SVG path also encodes: the
// glyph id numbering (rpcTypes) and the index-SNP size bump (Canvas2D). Both
// live in manhattan.slang as bare literals, tied to their TS counterparts only
// by comments. The naga test next door only proves the WGSL compiles — and is
// skipped when naga isn't installed — so nothing else catches a drift that
// silently makes the GPU draw different glyphs than the Canvas2D fallback and
// the SVG export.
const slang = readFileSync(path.join(__dirname, 'shaders/manhattan.slang'), {
  encoding: 'utf8',
})

test('shader index-glyph scale matches the Canvas2D/SVG one', () => {
  const m = /static const float INDEX_GLYPH_SCALE = ([\d.]+);/.exec(slang)
  expect(m).not.toBeNull()
  expect(Number(m![1])).toBe(INDEX_GLYPH_SCALE)
})

// Each glyph id's shader branch, keyed by the shape it must select. Pins the
// id->shape mapping itself rather than just the set of ids, so renumbering a
// constant fails here instead of silently swapping glyphs on the GPU.
test.each([
  ['insertion -> triangle', `inst.glyph == ${GLYPH_INSERTION}u ? SHAPE_TRI`],
  ['index -> diamond', `inst.glyph == ${GLYPH_INDEX}u ? SHAPE_DIAMOND`],
  ['index -> size bump', `inst.glyph == ${GLYPH_INDEX}u ? INDEX_GLYPH_SCALE`],
  ['point -> small-point fast path', `inst.glyph == ${GLYPH_POINT}u &&`],
])('shader maps %s', (_label, branch) => {
  expect(slang).toContain(branch)
})
