import {
  computeVisibleAnnotations,
  findFrameAt,
} from './computeVisibleAnnotations.ts'

import type { MafFrameRecord } from '../../types.ts'

const rowIndexBySrc = new Map([
  ['panTro6', 0],
  ['mm10', 1],
  ['rn6', 2],
])

const view = {
  bpPerPx: 1,
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 100,
      end: 200,
      screenStartPx: 0,
      reversed: false,
    },
  ],
}

function rec(over: Partial<MafFrameRecord>): MafFrameRecord {
  return {
    refName: 'chr1',
    start: 100,
    end: 110,
    src: 'mm10',
    frame: 0,
    strand: 1,
    name: 'GENE1',
    ...over,
  }
}

test('positions a CDS frame strip at the bottom of its species row', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => [rec({ src: 'rn6', frame: 1 })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // h=12, offset=1.5, stripH=3, stripOffset=1.5+12-3=10.5
  // row 2: rowTop = 10.5 + 15*2 = 40.5; + strand frame 1 → palette slot 2
  expect(markers).toEqual([
    {
      xLeft: 0,
      width: 10,
      rowTop: 40.5,
      h: 3,
      colorIndex: 2,
    },
  ])
})

// A 447-way alignment in fit mode puts `rowHeight` near 1, and `resolveRowHeight`
// deliberately does not floor it — 2000 species in 600px is ~0.3. The drawn band
// floors at MIN_DRAWN_ROW_PX and overhangs its row there, exactly as the shader
// paints it, so the strip cannot be bounded by the row; what it must stay inside
// is the band, leaving the base/SNP colouring this function's docstring promises
// still visible underneath.
test.each([15, 4, 2.5, 1.24, 1, 0.5, 0.06])(
  'the CDS strip is a band on the row at rowHeight %p, not instead of it',
  rowHeight => {
    const markers = computeVisibleAnnotations({
      view,
      framesDataMap: { get: () => [rec({ src: 'rn6' })] },
      rowIndexBySrc,
      rowHeight,
      rowProportion: 0.8,
      scrollTop: 0,
      viewportHeight: 1000,
    })
    const drawnBand = Math.max(rowHeight * 0.8, 1)
    expect(markers[0]!.h).toBeLessThanOrEqual(drawnBand / 2)
  },
)

// `frameColorIndex` mirrors the `−` half of the palette onto the `+` half, so
// one reading frame is one color whichever strand the gene is on. It used to
// hand the painter a NEGATIVE index and rely on `Array.at` wrapping it to the
// far end of a table laid out in reverse — three pieces of arithmetic in three
// files that were only jointly checkable.
test('mirrors the palette slot for minus-strand CDS', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => [rec({ frame: 2, strand: -1 })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // frame 2 → slot 3 on `+`, mirrored to 6-2=4 on `−`, which the palette gives
  // the same hue
  expect(markers[0]!.colorIndex).toBe(4)
})

test('drops rows whose src is not in the current source set', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => [rec({ src: 'unlisted_species' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(markers).toHaveLength(0)
})

test('mirrors x for reversed regions', () => {
  const markers = computeVisibleAnnotations({
    view: {
      bpPerPx: 1,
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 100,
          end: 200,
          screenStartPx: 0,
          reversed: true,
        },
      ],
    },
    framesDataMap: { get: () => [rec({ src: 'panTro6' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // reversed: bp100..110 → px100..90, left=90 width=10
  expect(markers[0]).toMatchObject({ xLeft: 90, width: 10 })
})

// Reversed AND sub-pixel, the only combination that tells the two anchors
// apart: the widening grows away from the record's START edge, its RIGHT edge
// here, so the strip ends at px10. Anchoring the leftmost edge instead puts it
// at 9.9 and slides the strip a pixel off the exon it marks.
test('widens a sub-pixel strip away from its start edge on a reversed region', () => {
  const markers = computeVisibleAnnotations({
    view: {
      bpPerPx: 10,
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 100,
          end: 200,
          screenStartPx: 0,
          reversed: true,
        },
      ],
    },
    framesDataMap: { get: () => [rec({ start: 100, end: 101 })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(markers[0]).toMatchObject({ xLeft: 9, width: 1 })
})

test('emits nothing when a region has no fetched frames', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => undefined },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(markers).toHaveLength(0)
})

describe('findFrameAt', () => {
  const records = [
    rec({ src: 'mm10', start: 100, end: 110, name: 'GENE1' }),
    rec({ src: 'rn6', start: 100, end: 110, name: 'GENE2' }),
  ]

  test('matches a position within a record on the right row', () => {
    expect(findFrameAt(records, 105, 1, rowIndexBySrc)?.name).toBe('GENE1')
    expect(findFrameAt(records, 105, 2, rowIndexBySrc)?.name).toBe('GENE2')
  })

  test('is half-open: end is exclusive, start inclusive', () => {
    expect(findFrameAt(records, 100, 1, rowIndexBySrc)?.name).toBe('GENE1')
    expect(findFrameAt(records, 110, 1, rowIndexBySrc)).toBeUndefined()
  })

  test('does not match a position on a different row', () => {
    expect(findFrameAt(records, 105, 0, rowIndexBySrc)).toBeUndefined()
  })

  test('returns undefined when there are no records', () => {
    expect(findFrameAt(undefined, 105, 1, rowIndexBySrc)).toBeUndefined()
  })
})

// One record per CDS exon per species over the *buffered* region, so a
// gene-dense window across a deep alignment produces a lot of them and about
// half sit off screen. Same `[bpLo, bpHi)` cull the block overlays apply.
test('skips frame records outside the visible span', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: {
      get: () => [
        rec({ start: 0, end: 50 }),
        rec({ start: 120, end: 130 }),
        rec({ start: 400, end: 500 }),
      ],
    },
    rowIndexBySrc,
    rowHeight: 20,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(markers).toHaveLength(1)
  expect(markers[0]!.xLeft).toBe(20)
})
