// The expected bytes are spelled out from the shader's own offsets and from
// `bandPairIndex`, so the test states the layout independently of the packer:
// a field reordered in `ldGenomic.slang` moves both sides and stays green, but a
// packer that put a cell at the wrong (i, j), or fed a lane the wrong value,
// does not.
import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'

import { bandCellCount, bandPairIndex } from '../../RenderLDDataRPC/ldBand.ts'
import { packGenomicCells } from './ldMarks.ts'
import {
  INSTANCE_OFFSET_F32 as OFF,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/ldGenomic.iface.generated.ts'

const N = 7
const BAND = 3
// uneven widths, so a column read as a row is a visibly wrong number
const boundaries = Float32Array.from([0, 3, 10, 12, 30, 31, 45, 60])
const numCells = bandCellCount(N, BAND)

function valuesWith(uncomputed: [number, number][] = []) {
  const ldValues = new Float32Array(numCells).map((_, k) => (k + 1) / 100)
  for (const [i, j] of uncomputed) {
    ldValues[bandPairIndex(i, j, BAND)] = LD_NOT_COMPUTED
  }
  return ldValues
}

function unpack(buf: ArrayBuffer) {
  const f32 = new Float32Array(buf)
  const cells = []
  for (let o = 0; o < f32.length; o += INSTANCE_STRIDE_WORDS) {
    cells.push({
      x: f32[o + OFF.position]!,
      y: f32[o + OFF.position + 1]!,
      w: f32[o + OFF.cellSize]!,
      h: f32[o + OFF.cellSize + 1]!,
      v: f32[o + OFF.ldValue]!,
    })
  }
  return cells
}

function expectedCell(i: number, j: number, ldValues: Float32Array) {
  return {
    x: boundaries[j],
    y: boundaries[i],
    w: boundaries[j + 1]! - boundaries[j]!,
    h: boundaries[i + 1]! - boundaries[i]!,
    v: ldValues[bandPairIndex(i, j, BAND)],
  }
}

function bandPairs() {
  const pairs: [number, number][] = []
  for (let i = 1; i < N; i++) {
    for (let j = Math.max(0, i - BAND); j < i; j++) {
      pairs.push([i, j])
    }
  }
  return pairs
}

describe('packGenomicCells', () => {
  test('packs one instance per band cell, each on its boundaries', () => {
    const ldValues = valuesWith()
    const buf = packGenomicCells({ boundaries, band: BAND, ldValues, numCells })

    expect(buf.byteLength).toBe(numCells * INSTANCE_STRIDE_BYTES)
    expect(unpack(buf)).toEqual(
      bandPairs().map(([i, j]) => expectedCell(i, j, ldValues)),
    )
  })

  test('skips a cell nothing computed and keeps every other on its own cell', () => {
    const skipped: [number, number][] = [
      [2, 0],
      [5, 4],
    ]
    const ldValues = valuesWith(skipped)
    const buf = packGenomicCells({ boundaries, band: BAND, ldValues, numCells })

    expect(buf.byteLength).toBe((numCells - 2) * INSTANCE_STRIDE_BYTES)
    expect(unpack(buf)).toEqual(
      bandPairs()
        .filter(([i, j]) => !skipped.some(([a, b]) => a === i && b === j))
        .map(([i, j]) => expectedCell(i, j, ldValues)),
    )
  })

  test('packs a real 0', () => {
    const ldValues = valuesWith()
    ldValues[0] = 0
    const buf = packGenomicCells({ boundaries, band: BAND, ldValues, numCells })

    expect(buf.byteLength).toBe(numCells * INSTANCE_STRIDE_BYTES)
  })

  test('packs nothing for a matrix with no computed cells', () => {
    const ldValues = new Float32Array(numCells).fill(LD_NOT_COMPUTED)

    expect(
      packGenomicCells({ boundaries, band: BAND, ldValues, numCells })
        .byteLength,
    ).toBe(0)
    expect(
      packGenomicCells({
        boundaries: new Float32Array(0),
        band: 0,
        ldValues: new Float32Array(0),
        numCells: 0,
      }).byteLength,
    ).toBe(0)
  })

  test('the three fields occupy distinct words', () => {
    expect(new Set([OFF.position, OFF.cellSize, OFF.ldValue]).size).toBe(3)
  })
})
