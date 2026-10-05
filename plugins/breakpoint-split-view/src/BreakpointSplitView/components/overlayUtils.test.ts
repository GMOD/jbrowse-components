import { PAIR_DIRECTION_NUM } from '@jbrowse/alignments-core'

import {
  buildBreakpointPath,
  chainHighlightRects,
  drawnConnections,
} from './overlayUtils.tsx'

import type { ReadEntry } from '../readChains.ts'
import type { ConnectorRow, LayoutRecord, OverlayLevel } from '../types.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

const row: ConnectorRow = { minimized: false, linksReads: false }

describe('chainHighlightRects', () => {
  const entry = (
    id: string,
    refName: string,
    level: number,
    displayedRegionIndex = 0,
  ): ReadEntry => ({
    level,
    groupKey: '',
    displayedRegionIndex,
    refName,
    data: {
      readKeys: [id],
      readIdPrefix: undefined,
    } as unknown as ReadEntry['data'],
    readIdx: 0,
  })
  const level = (yOffset: number): OverlayLevel => ({
    yOffset,
    height: 100,
    coverageOffset: 0,
    scrollTop: 0,
    offsetPx: 0,
  })
  const layout = (refName: string): ViewLayout => ({
    displayedRegions: [
      { refName, start: 0, end: 1000, assemblyName: 'volvox' },
    ],
    bpPerPx: 1,
    offsetPx: 0,
    width: 500,
    minimumBlockWidth: 3,
  })
  const a = entry('a', 'chr1', 0)
  const b = entry('b', 'chr2', 1)
  const c = entry('c', 'chr3', 2)
  const ctx = {
    rows: [row, row, row],
    levels: [level(0), level(200), level(400)],
    layouts: [layout('chr1'), layout('chr2'), layout('chr3')],
    entryLayouts: new Map<ReadEntry, LayoutRecord>([
      [a, [10, 5, 60, 15]],
      [b, [20, 5, 70, 15]],
      [c, [30, 5, 80, 15]],
    ]),
  }

  test('boxes every panel a multi-hop read visits', () => {
    expect(chainHighlightRects({ ...ctx, entries: [a, b, c] })).toEqual([
      { key: '0-0-a', x: 10, y: 5, width: 50, height: 10 },
      { key: '1-0-b', x: 20, y: 205, width: 50, height: 10 },
      { key: '2-0-c', x: 30, y: 405, width: 50, height: 10 },
    ])
  })

  test('a minimized level contributes no box', () => {
    const rects = chainHighlightRects({
      ...ctx,
      rows: [row, { ...row, minimized: true }, row],
      entries: [a, b],
    })
    expect(rects.map(r => r.key)).toEqual(['0-0-a'])
  })

  test('a segment with no layout rect is left out', () => {
    const rects = chainHighlightRects({
      ...ctx,
      entries: [a, entry('d', 'chr2', 1)],
    })
    expect(rects.map(r => r.key)).toEqual(['0-0-a'])
  })

  // A read two overlapping windows of one panel both fetched is in the chain
  // once per window, and the two boxes need two keys.
  test('one record fetched by two windows boxes twice under distinct keys', () => {
    const again = entry('a', 'chr1', 0, 1)
    const rects = chainHighlightRects({
      ...ctx,
      entryLayouts: new Map<ReadEntry, LayoutRecord>([
        [a, [10, 5, 60, 15]],
        [again, [10, 5, 60, 15]],
      ]),
      entries: [a, again],
    })
    expect(rects.map(r => r.key)).toEqual(['0-0-a', '0-1-a'])
  })
})

describe('drawnConnections', () => {
  const entry = (
    refName: string,
    strand: number,
    level: number,
    orientation = 0,
    interchrom = 0,
  ): ReadEntry => ({
    level,
    groupKey: '',
    displayedRegionIndex: 0,
    refName,
    data: {
      readKeys: [refName],
      readPositions: Uint32Array.from([100, 200]),
      readFlags: Uint16Array.from([0]),
      readStrands: Int8Array.from([strand]),
      readInterchrom: Uint8Array.from([interchrom]),
      readPairOrientations: Uint8Array.from([orientation]),
    } as unknown as ReadEntry['data'],
    readIdx: 0,
  })
  const rows: ConnectorRow[] = [{ ...row, linksReads: true }, row]
  const kinds = (
    pairs: [ReadEntry, ReadEntry][],
    showIntraviewLinks = true,
    isSplit = true,
    drawnRows = rows,
  ) =>
    [
      ...drawnConnections({
        chains: pairs.map(([e1, e2]) => ({
          entries: [e1, e2],
          connections: [{ e1, e2, isSplit }],
        })),
        entryLayouts: new Map(
          pairs.flat().map(e => [e, [0, 0, 0, 0] as LayoutRecord]),
        ),
        rows: drawnRows,
        showIntraviewLinks,
      }),
    ].map(c => c.kind)

  test('a split junction takes its strands, on any pair of chromosomes', () => {
    expect(
      kinds([
        [entry('chr1', 1, 0), entry('chr1', -1, 1)],
        [entry('chr1', 1, 0), entry('chr2', 1, 1)],
      ]),
    ).toEqual(['splitInversion', 'splitDeletion'])
  })

  test('drops what the pileup links itself, and intra-view links when they are off', () => {
    expect(kinds([[entry('chr1', 1, 0), entry('chr1', 1, 0)]])).toEqual([])
    expect(kinds([[entry('chr1', 1, 1), entry('chr1', 1, 1)]])).toEqual([
      'splitDeletion',
    ])
    expect(kinds([[entry('chr1', 1, 1), entry('chr1', 1, 1)]], false)).toEqual(
      [],
    )
  })

  test('a mate link takes its pair orientation, or inter-chromosomal ahead of it', () => {
    expect(
      kinds(
        [[entry('chr1', 1, 0, PAIR_DIRECTION_NUM.RL), entry('chr1', -1, 1)]],
        true,
        false,
      ),
    ).toEqual(['pairRL'])
    expect(
      kinds(
        [
          [
            entry('chr1', 1, 0, PAIR_DIRECTION_NUM.LR, 1),
            entry('chr2', -1, 1, PAIR_DIRECTION_NUM.LR, 1),
          ],
        ],
        true,
        false,
      ),
    ).toEqual(['interchrom'])
  })

  test('a connection touching a minimized row is not drawn', () => {
    expect(
      kinds([[entry('chr1', 1, 0), entry('chr2', 1, 1)]], true, true, [
        rows[0]!,
        { ...row, minimized: true },
      ]),
    ).toEqual([])
  })

  test('a read laid out in no row draws nothing', () => {
    const e1 = entry('chr1', 1, 0)
    const e2 = entry('chr2', 1, 1)
    expect([
      ...drawnConnections({
        chains: [
          { entries: [e1, e2], connections: [{ e1, e2, isSplit: true }] },
        ],
        entryLayouts: new Map([[e1, [0, 0, 0, 0] as LayoutRecord]]),
        rows,
        showIntraviewLinks: true,
      }),
    ]).toEqual([])
  })
})

describe('buildBreakpointPath', () => {
  test('builds straight line with ticks when y values differ', () => {
    const path = buildBreakpointPath(50, 0, 150, 50, 30, 170)
    expect(path).toBe('M 30 0 L 50 0 L 150 50 L 170 50')
  })

  test('builds arc with ticks when y values are equal (flat line)', () => {
    const path = buildBreakpointPath(50, 100, 150, 100, 30, 170)
    expect(path).toContain('M 30 100 L 50 100')
    expect(path).toContain('Q')
    expect(path).toContain('L 170 100')
    expect(path).toContain('100 70')
  })

  test('arc control point is at midpoint horizontally', () => {
    const path = buildBreakpointPath(0, 100, 200, 100, -20, 220)
    expect(path).toContain('100 70')
  })
})
