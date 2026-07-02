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
test('resolveCellColor and resolveCellPacked agree across every branch', () => {
  const refs = ['A', 'C', '-'].map(byte)
  const alns = ['A', 'G', '-', ' ', 'N', 'X'].map(byte)
  for (const showAllLetters of [false, true]) {
    for (const mismatchRendering of [false, true]) {
      const c = { ...cfg, showAllLetters, mismatchRendering }
      const packed = packMafCellColorConfig(c)
      for (const refByte of refs) {
        for (const alnByte of alns) {
          const css = resolveCellColor(refByte, alnByte, c)
          const int = resolveCellPacked(refByte, alnByte, packed)
          if (css === undefined) {
            expect(int).toBe(RESOLVE_PACKED_SKIP)
          } else {
            expect(int).toBe(cssColorToABGR(css))
          }
        }
      }
    }
  }
})

test('reference insertion (ref dash) is skipped in both resolvers', () => {
  expect(resolveCellColor(byte('-'), byte('A'), cfg)).toBeUndefined()
  expect(
    resolveCellPacked(byte('-'), byte('A'), packMafCellColorConfig(cfg)),
  ).toBe(RESOLVE_PACKED_SKIP)
})
