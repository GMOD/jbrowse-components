import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
} from './cigarConstants.ts'
import { getNextRefPos } from './getNextRefPos.ts'
import { refWindowToRead } from './refWindowToRead.ts'

const op = (len: number, code: number) => (len << 4) | code

function span(ops: number[], refStart: number, refEnd: number) {
  const {
    readStart,
    readEnd,
    refStart: s,
    refEnd: e,
  } = refWindowToRead(ops, refStart, refEnd)
  return { read: [readStart, readEnd], ref: [s, e] }
}

test('a fully aligned read maps the window onto the same offsets', () => {
  expect(span([op(100, CIGAR_M)], 10, 20)).toEqual({
    read: [10, 20],
    ref: [10, 20],
  })
})

test('a window reaching before the read starts after the leading clip', () => {
  expect(span([op(5, CIGAR_S), op(10, CIGAR_M)], -5, 3)).toEqual({
    read: [5, 8],
    ref: [0, 3],
  })
})

test('a window reaching past the read runs through the trailing clip', () => {
  expect(span([op(10, CIGAR_M), op(5, CIGAR_S)], 5, 100)).toEqual({
    read: [5, 15],
    ref: [5, 10],
  })
})

test('an insertion inside the window is inside the read range', () => {
  expect(
    span([op(10, CIGAR_M), op(4, CIGAR_I), op(10, CIGAR_M)], 8, 12),
  ).toEqual({ read: [8, 16], ref: [8, 12] })
})

test('a window straddling a deletion or a skip covers the bases either side', () => {
  for (const gap of [CIGAR_D, CIGAR_N]) {
    expect(
      span([op(10, CIGAR_M), op(50, gap), op(10, CIGAR_M)], 5, 65),
    ).toEqual({ read: [5, 15], ref: [5, 65] })
  }
})

test('a window with no aligned base is empty', () => {
  const gapped = [op(10, CIGAR_M), op(50, CIGAR_D), op(10, CIGAR_M)]
  expect(span(gapped, 20, 30).read).toEqual([10, 10])
  expect(span([op(10, CIGAR_M)], 20, 30)).toEqual({
    read: [10, 10],
    ref: [20, 20],
  })
  expect(span([op(10, CIGAR_M)], -10, -2).read).toEqual([0, 0])
  expect(span([op(10, CIGAR_M)], 6, 6).read).toEqual([6, 6])
})

test('a walk from the cursor places what a walk from the first op places', () => {
  const ops = [
    op(3, CIGAR_S),
    op(8, CIGAR_M),
    op(2, CIGAR_I),
    op(6, CIGAR_M),
    op(3, CIGAR_D),
    op(7, CIGAR_M),
    op(2, CIGAR_S),
  ]
  const positions = Array.from({ length: 28 }, (_, i) => i)
  const all = new Map<number, number>()
  getNextRefPos(ops, positions, (ref, idx) => all.set(positions[idx]!, ref))
  for (let refStart = -2; refStart < 26; refStart++) {
    for (let refEnd = refStart + 1; refEnd <= 26; refEnd++) {
      const window = refWindowToRead(ops, refStart, refEnd)
      const inside = positions.filter(
        p => p >= window.readStart && p < window.readEnd,
      )
      const got: [number, number][] = []
      getNextRefPos(
        ops,
        inside,
        (ref, idx) => got.push([inside[idx]!, ref]),
        window,
      )
      expect(got).toEqual(
        [...all].filter(([, ref]) => ref >= refStart && ref < refEnd),
      )
    }
  }
})
