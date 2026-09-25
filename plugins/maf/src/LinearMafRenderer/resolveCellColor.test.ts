import { DASH } from '../util/asciiBytes.ts'
import {
  RESOLVE_PACKED_SKIP,
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
  colorMatches: false,
}

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
test('the packed colour table agrees with the cascade over every byte pair', () => {
  const disagreements: string[] = []
  for (const colorMatches of [false, true]) {
    const packed = packMafCellColorConfig({ ...cfg, colorMatches })
    for (let refByte = 0; refByte < 256; refByte++) {
      for (let alnByte = 0; alnByte < 256; alnByte++) {
        const int = resolveCellPacked(refByte, alnByte, packed)
        const want =
          refByte === DASH
            ? RESOLVE_PACKED_SKIP
            : resolvePackedUncached(refByte, alnByte, packed)
        if (int !== want) {
          disagreements.push(
            `ref=${refByte} aln=${alnByte} colorMatches=${colorMatches}: table ${int} !== cascade ${want}`,
          )
        }
      }
    }
  }
  expect(disagreements).toEqual([])
})

test('reference insertion (ref dash) is skipped', () => {
  expect(
    resolveCellPacked(byte('-'), byte('A'), packMafCellColorConfig(cfg)),
  ).toBe(RESOLVE_PACKED_SKIP)
})

test('a match paints the match colour, or its own base under colorMatches', () => {
  const at = (colorMatches: boolean) =>
    resolveCellPacked(
      byte('A'),
      byte('a'),
      packMafCellColorConfig({ ...cfg, colorMatches }),
    )
  const { match, packedByLowerByte } = packMafCellColorConfig(cfg)
  expect(at(false)).toBe(match)
  expect(at(true)).toBe(packedByLowerByte[byte('a')])
})
