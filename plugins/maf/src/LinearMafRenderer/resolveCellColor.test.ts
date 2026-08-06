import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  RESOLVE_PACKED_SKIP,
  packMafCellColorConfig,
  resolveCellColor,
  resolveCellPacked,
} from './resolveCellColor.ts'

import type { MafCellColorConfig } from './resolveCellColor.ts'

const cfg: MafCellColorConfig = {
  colorForBase: {
    a: '#ff0000',
    c: '#00ff00',
    g: '#0000ff',
    t: '#ffff00',
    n: '#888888',
  },
  matchColor: '#111111',
  gapColor: '#222222',
  mismatchOffColor: '#333333',
  unknownBaseColor: '#444444',
  showAllLetters: false,
  mismatchRendering: true,
}

const byte = (c: string) => c.charCodeAt(0)

// The CSS resolver and the packed (GPU) resolver must map every cell to the
// same color — a divergence would show as GPU-vs-Canvas2D pixel mismatches. The
// shared `classifyCell` cascade is what guarantees this; this test pins it.
//
// Swept over the whole 7-bit domain rather than a handful of representative
// bases, because the packed side no longer walks the cascade per cell: it reads
// a table keyed on `(alnByte, isMatch)` only, and the claim that the reference
// byte is otherwise irrelevant is exactly what an exhaustive sweep checks.
// (7-bit, not 8: alignment bytes are always ASCII, and above 127 the packed
// side's `& 0x7f` folds high bytes onto letters the CSS side calls unknown.)
test('resolveCellColor and resolveCellPacked agree over every ASCII pair', () => {
  const disagreements: string[] = []
  for (const showAllLetters of [false, true]) {
    for (const mismatchRendering of [false, true]) {
      const c = { ...cfg, showAllLetters, mismatchRendering }
      const packed = packMafCellColorConfig(c)
      for (let refByte = 0; refByte < 128; refByte++) {
        for (let alnByte = 0; alnByte < 128; alnByte++) {
          const css = resolveCellColor(refByte, alnByte, c)
          const int = resolveCellPacked(refByte, alnByte, packed)
          const want =
            css === undefined ? RESOLVE_PACKED_SKIP : cssColorToABGR(css)
          if (int !== want) {
            disagreements.push(
              `ref=${refByte} aln=${alnByte} showAllLetters=${showAllLetters} mismatchRendering=${mismatchRendering}: packed ${int} !== css ${want}`,
            )
          }
        }
      }
    }
  }
  expect(disagreements).toEqual([])
})

test('reference insertion (ref dash) is skipped in both resolvers', () => {
  expect(resolveCellColor(byte('-'), byte('A'), cfg)).toBeUndefined()
  expect(
    resolveCellPacked(byte('-'), byte('A'), packMafCellColorConfig(cfg)),
  ).toBe(RESOLVE_PACKED_SKIP)
})
