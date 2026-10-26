import { DASH } from '@jbrowse/core/util/alignedBytes'

import {
  packMafCellColorConfig,
  resolveCellPacked,
  resolvePackedUncached,
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
  unknownBaseColor: '#444444',
  paints: { mismatches: true, everyBase: false },
}

const PAINTS = [
  { mismatches: true, everyBase: false },
  { mismatches: false, everyBase: false },
  { mismatches: true, everyBase: true },
]

const byte = (c: string) => c.charCodeAt(0)

// `packMafCellColorConfig` builds its 65536-entry table by memcpy — one
// mismatch row stamped per reference byte, with the two case-folding matches
// overwritten — rather than by running the cascade 65536 times. That is a
// claim about which inputs the answer depends on, and an exhaustive sweep
// against the cascade is what checks it.
//
// 8-bit and not 7, even though alignment bytes are always ASCII: the base
// lookup masks `& 0x7f` because its table is 128 entries, so a high byte folds
// onto a letter, and the range where that is the only thing keeping the two
// together is the range a 7-bit sweep excludes.
test('the packed color table agrees with the cascade over every byte pair', () => {
  const disagreements: string[] = []
  for (const paints of PAINTS) {
    const packed = packMafCellColorConfig({ ...cfg, paints })
    for (let refByte = 0; refByte < 256; refByte++) {
      if (refByte === DASH) {
        continue
      }
      for (let alnByte = 0; alnByte < 256; alnByte++) {
        const int = resolveCellPacked(refByte, alnByte, packed)
        const want = resolvePackedUncached(refByte, alnByte, packed)
        if (int !== want) {
          disagreements.push(
            `ref=${refByte} aln=${alnByte} paints=${JSON.stringify(paints)}: table ${int} !== cascade ${want}`,
          )
        }
      }
    }
  }
  expect(disagreements).toEqual([])
})

test('a match paints the fill, or its own base under the base layer', () => {
  const at = (everyBase: boolean) =>
    resolveCellPacked(
      byte('A'),
      byte('a'),
      packMafCellColorConfig({
        ...cfg,
        paints: { mismatches: true, everyBase },
      }),
    )
  const { match, packedByLowerByte } = packMafCellColorConfig(cfg)
  expect(at(false)).toBe(match)
  expect(at(true)).toBe(packedByLowerByte[byte('a')])
})

test('a differing base paints the fill while the mismatches are off', () => {
  const at = (mismatches: boolean) =>
    resolveCellPacked(
      byte('A'),
      byte('c'),
      packMafCellColorConfig({
        ...cfg,
        paints: { mismatches, everyBase: false },
      }),
    )
  const { match, packedByLowerByte } = packMafCellColorConfig(cfg)
  expect(at(false)).toBe(match)
  expect(at(true)).toBe(packedByLowerByte[byte('c')])
})
