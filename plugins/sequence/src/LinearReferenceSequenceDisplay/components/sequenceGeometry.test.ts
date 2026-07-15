import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import {
  codonKind,
  frameShiftBounds,
  visibleCodonRange,
  visibleRange,
} from './sequenceGeometry.ts'

import type { Frame } from '@jbrowse/core/util'

const standard = getGeneticCode(1).codonTable
const vertebrateMito = getGeneticCode(2).codonTable

test('visibleRange clamps to sequence bounds', () => {
  // block fully inside the fetched region
  expect(visibleRange(110, 120, 100, 50)).toEqual({ start: 10, end: 20 })
  // block extends past both edges -> clamped to [0, seqLen]
  expect(visibleRange(80, 200, 100, 50)).toEqual({ start: 0, end: 50 })
  // fractional edges floor/ceil outward so partial bases still render
  expect(visibleRange(110.4, 119.2, 100, 50)).toEqual({ start: 10, end: 20 })
})

test('frameShiftBounds anchors codons to absolute coordinate mod 3', () => {
  // same frame, regions starting one base apart -> codons land on the same
  // absolute genomic phase regardless of where the region was fetched
  for (const frame of [1, 2, 3, -1, -2, -3] as Frame[]) {
    const a = frameShiftBounds('A'.repeat(30), 30, frame)
    const b = frameShiftBounds('A'.repeat(30), 31, frame)
    expect((30 + a.frameShift) % 3).toBe((31 + b.frameShift) % 3)
  }
})

test('the three reverse frames cover all three phases', () => {
  const phases = [-1, -2, -3].map(
    f =>
      (100 + frameShiftBounds('A'.repeat(30), 100, f as Frame).frameShift) % 3,
  )
  expect([...phases].sort()).toEqual([0, 1, 2])
})

test('visibleCodonRange snaps to the frame grid and clamps to complete codons', () => {
  const seq = 'A'.repeat(30)
  const seqStart = 100
  const { frameShift, sliceEnd } = frameShiftBounds(seq, seqStart, 1)
  const r = visibleCodonRange(
    115,
    125,
    seqStart,
    seq.length,
    frameShift,
    sliceEnd,
  )

  // start is on a codon boundary relative to frameShift
  expect((r.start - frameShift) % 3).toBe(0)
  // never reads past the last complete codon
  expect(r.end).toBeLessThanOrEqual(sliceEnd)
  // includes a codon of slop before the visible window (index 15 -> <= 12)
  expect(r.start).toBeLessThanOrEqual(15)
})

test('codonKind classifies start/stop/normal under the standard code', () => {
  expect(codonKind('ATG', standard)).toBe('start')
  expect(codonKind('TAA', standard)).toBe('stop')
  expect(codonKind('TAG', standard)).toBe('stop')
  expect(codonKind('TGA', standard)).toBe('stop')
  expect(codonKind('AAA', standard)).toBe('normal')
})

test('codonKind stops follow the genetic code (vertebrate mitochondrial)', () => {
  // TGA is Trp (not a stop) and AGA/AGG are stops under the mito code
  expect(codonKind('TGA', vertebrateMito)).toBe('normal')
  expect(codonKind('AGA', vertebrateMito)).toBe('stop')
  expect(codonKind('AGG', vertebrateMito)).toBe('stop')
  // ATG start highlighting is unchanged across codes
  expect(codonKind('ATG', vertebrateMito)).toBe('start')
})
