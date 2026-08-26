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
// Swept over the whole 8-bit domain rather than a handful of representative
// bases, because the packed side no longer walks the cascade per cell: it reads
// a table keyed on `(alnByte, isMatch)` only, and the claim that the reference
// byte is otherwise irrelevant is exactly what an exhaustive sweep checks.
//
// 8-bit and not 7, even though alignment bytes are always ASCII: the packed
// side's base lookup masks `& 0x7f` because its table is 128 entries, so a high
// byte folds onto a letter. The CSS side now masks the same way, and the range
// where that is the *only* thing keeping them together is the range a 7-bit
// sweep excludes.
test('resolveCellColor and resolveCellPacked agree over every byte pair', () => {
  const disagreements: string[] = []
  for (const showAllLetters of [false, true]) {
    for (const mismatchRendering of [false, true]) {
      const c = { ...cfg, showAllLetters, mismatchRendering }
      const packed = packMafCellColorConfig(c)
      for (let refByte = 0; refByte < 256; refByte++) {
        for (let alnByte = 0; alnByte < 256; alnByte++) {
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
