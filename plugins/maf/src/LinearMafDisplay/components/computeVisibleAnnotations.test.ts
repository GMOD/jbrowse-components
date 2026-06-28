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
  })
  // h=12, offset=1.5, stripH=3, stripOffset=1.5+12-3=10.5
  // row 2: rowTop = 10.5 + 15*2 = 40.5; + strand frame 1 → index 2
  expect(markers).toEqual([
    {
      xLeft: 0,
      width: 10,
      rowTop: 40.5,
      h: 3,
      frameIndex: 2,
    },
  ])
})

test('mirrors the frame index for minus-strand CDS', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => [rec({ frame: 2, strand: -1 })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
  })
  // frame 2 → base 3, minus strand → -3
  expect(markers[0]!.frameIndex).toBe(-3)
})

test('drops rows whose src is not in the current source set', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => [rec({ src: 'unlisted_species' })] },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
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
  })
  // reversed: bp100..110 → px100..90, left=90 width=10
  expect(markers[0]).toMatchObject({ xLeft: 90, width: 10 })
})

test('emits nothing when a region has no fetched frames', () => {
  const markers = computeVisibleAnnotations({
    view,
    framesDataMap: { get: () => undefined },
    rowIndexBySrc,
    rowHeight: 15,
    rowProportion: 0.8,
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
