import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  GLYPH_INDEX,
  GLYPH_INSERTION,
  GLYPH_POINT,
} from '../ManhattanRPC/rpcTypes.ts'

// The GPU path duplicates something the Canvas2D/SVG path also encodes: the
// glyph id numbering (rpcTypes), tied to its shader counterpart only by
// comments. The naga test next door only proves the WGSL compiles — and is
// skipped when naga isn't installed — so nothing else catches a drift that
// silently makes the GPU draw different glyphs than the Canvas2D fallback and
// the SVG export.
//
// The index-SNP size bump used to be checked here too, by scraping
// `INDEX_GLYPH_SCALE` out of the source and comparing it to a TS literal. It is
// `//! export-consts`ed now, so the Canvas2D path reads the shader's own value
// and there is nothing left to compare.
const slang = readFileSync(path.join(__dirname, 'shaders/manhattan.slang'), {
  encoding: 'utf8',
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
