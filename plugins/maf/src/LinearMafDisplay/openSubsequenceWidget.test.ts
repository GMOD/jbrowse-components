import { selectionRegion } from './openSubsequenceWidget.ts'

import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'

// What `view.pxToBp` reports for a pixel: the region it landed in, plus the
// float bp offset from that region's LEFT SCREEN EDGE (which runs rightward in
// bp on a forward region and leftward on a reversed one).
function at(
  offset: number,
  {
    start = 1000,
    end = 2000,
    reversed = false,
    index = 0,
    refName = 'ctgA',
  } = {},
): PxToBpResult {
  return {
    refName,
    start,
    end,
    reversed,
    assemblyName: 'volvox',
    index,
    offset,
    oob: offset < 0 || offset >= end - start,
    coord0: Math.floor(reversed ? end - offset : start + offset),
    coord: Math.floor(reversed ? end - offset : start + offset) + 1,
  }
}

describe('the drag selection resolves to an ordered region', () => {
  it('spans the dragged bases on a forward region', () => {
    expect(selectionRegion(at(10), at(30))).toEqual({
      refName: 'ctgA',
      start: 1010,
      end: 1031,
      assemblyName: 'volvox',
    })
  })

  it('reads a single-base drag as one base, not as an empty span', () => {
    const r = selectionRegion(at(10.2), at(10.7))
    expect(r.start).toBe(1010)
    expect(r.end).toBe(1011)
  })

  // Regression: the span was `{ start: left.coord0, end: right.coord }`, which
  // is ordered only on a forward region. Reversed, bp runs leftward, so the
  // LEFT pixel is the higher coordinate and that spelling produced end < start.
  // The worker sizes its per-sample row buffers from `end - start`, so a
  // negative length threw `RangeError: Invalid typed array length` out of the
  // RPC and the widget opened on an error instead of a sequence.
  it('stays ordered on a reversed region', () => {
    const r = selectionRegion(
      at(10, { reversed: true }),
      at(30, { reversed: true }),
    )
    expect(r.start).toBeLessThan(r.end)
    // the left pixel is the higher coordinate there, so the span runs from the
    // right pixel's base up to it — and it covers the same 21 bases the
    // forward case above does, since it is the same 20px drag
    expect(r).toEqual({
      refName: 'ctgA',
      start: 1969,
      end: 1990,
      assemblyName: 'volvox',
    })
  })

  // Regression: the right pixel was read in whatever region it landed in, so a
  // drag across a region boundary mixed two chromosomes' coordinates — and
  // since a later region typically starts at a much smaller coordinate, that
  // was the other way to get end < start.
  it('clips to the left pixel’s region rather than mixing chromosomes', () => {
    const r = selectionRegion(
      at(900),
      at(50, { start: 0, end: 5000, index: 1, refName: 'ctgB' }),
    )
    expect(r).toEqual({
      refName: 'ctgA',
      start: 1900,
      end: 2000,
      assemblyName: 'volvox',
    })
  })

  it('clips to the region start when the reversed one runs off its far edge', () => {
    const r = selectionRegion(
      at(10, { reversed: true }),
      at(50, { start: 0, end: 5000, index: 1, refName: 'ctgB' }),
    )
    expect(r).toEqual({
      refName: 'ctgA',
      start: 1000,
      end: 1990,
      assemblyName: 'volvox',
    })
  })

  it('clamps an out-of-bounds pixel into the region', () => {
    const r = selectionRegion(at(-40), at(30))
    expect(r.start).toBe(1000)
    expect(r.end).toBe(1031)
  })
})
