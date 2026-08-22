import { makeOffscreenLayout } from '../util.ts'
import {
  buildBreakpointPath,
  buildSimplePath,
  chainHighlightRects,
  isDrawnByPileup,
  resolvedPairs,
  strandToSign,
} from './overlayUtils.tsx'

import type { LayoutMatch, LayoutRecord, OverlayLevel } from '../types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

describe('strandToSign', () => {
  test('returns 1 for positive strand', () => {
    expect(strandToSign('+')).toBe(1)
  })

  test('returns -1 for negative strand', () => {
    expect(strandToSign('-')).toBe(-1)
  })

  test('returns 0 for unknown strand', () => {
    expect(strandToSign('.')).toBe(0)
    expect(strandToSign('')).toBe(0)
    expect(strandToSign('?')).toBe(0)
  })
})

describe('buildSimplePath', () => {
  test('builds straight line when y values differ', () => {
    const path = buildSimplePath(0, 0, 100, 50)
    expect(path).toBe('M 0 0 L 100 50')
  })

  test('builds arc when y values are equal (flat line)', () => {
    const path = buildSimplePath(0, 100, 100, 100)
    expect(path).toContain('Q')
    expect(path).toContain('M 0 100')
    expect(path).toContain('100 100')
    expect(path).toContain('50 70')
  })
})

describe('resolvedPairs', () => {
  const feat = (refName: string) =>
    ({
      id: () => refName,
      get: (k: string) => (k === 'refName' ? refName : undefined),
    }) as unknown as Feature
  const entry = (
    refName: string,
    hiddenSegmentsBefore?: string[],
  ): LayoutMatch => ({
    feature: feat(refName),
    layout: [0, 0, 0, 0],
    level: 0,
    clipLengthAtStartOfRead: 0,
    hiddenSegmentsBefore,
  })
  const assembly = {
    getCanonicalRefName: (r: string) => r,
  } as unknown as Assembly
  const tracks = [{ minimized: false }]

  test("carries the second entry's hiddenSegmentsBefore onto the pair", () => {
    const match = {
      layoutMatches: [[entry('chr1'), entry('chr2', ['chrX:500..549'])]],
    }
    const [pair] = [...resolvedPairs({ match, assembly, tracks })]
    expect(pair?.hiddenSegmentsBetween).toEqual(['chrX:500..549'])
  })

  test('leaves hiddenSegmentsBetween undefined for truly-consecutive segments', () => {
    const match = { layoutMatches: [[entry('chr1'), entry('chr2')]] }
    const [pair] = [...resolvedPairs({ match, assembly, tracks })]
    expect(pair?.hiddenSegmentsBetween).toBeUndefined()
  })

  // What lets a hover on one hop name the rest of the read's route
  test('every hop of one chain reports the same chunk, and a second chain a different one', () => {
    const match = {
      layoutMatches: [
        [entry('chr1'), entry('chr2'), entry('chr3')],
        [entry('chr4'), entry('chr5')],
      ],
    }
    expect(
      [...resolvedPairs({ match, assembly, tracks })].map(p => p.chunkIndex),
    ).toEqual([0, 0, 1])
  })
})

describe('chainHighlightRects', () => {
  const feat = (id: string, refName: string) =>
    ({
      id: () => id,
      get: (k: string) => (k === 'refName' ? refName : undefined),
    }) as unknown as Feature
  const entry = (
    id: string,
    refName: string,
    level: number,
    layout: LayoutRecord,
  ): LayoutMatch => ({
    feature: feat(id, refName),
    layout,
    level,
    clipLengthAtStartOfRead: 0,
  })
  const assembly = {
    getCanonicalRefName: (r: string) => (r === 'unknown' ? undefined : r),
  } as unknown as Assembly
  const level = (yOffset: number): OverlayLevel => ({
    yOffset,
    height: 100,
    coverageOffset: 0,
    scrollTop: 0,
    offsetPx: 0,
    linksReads: false,
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
  const ctx = {
    assembly,
    tracks: [{ minimized: false }, { minimized: false }, { minimized: false }],
    levels: [level(0), level(200), level(400)],
    layouts: [layout('chr1'), layout('chr2'), layout('chr3')],
  }

  test('boxes every panel a multi-hop read visits', () => {
    const rects = chainHighlightRects({
      ...ctx,
      chunk: [
        entry('a', 'chr1', 0, [10, 5, 60, 15]),
        entry('b', 'chr2', 1, [20, 5, 70, 15]),
        entry('c', 'chr3', 2, [30, 5, 80, 15]),
      ],
    })
    expect(rects).toEqual([
      { key: '0-a', x: 10, y: 5, width: 50, height: 10 },
      { key: '1-b', x: 20, y: 205, width: 50, height: 10 },
      { key: '2-c', x: 30, y: 405, width: 50, height: 10 },
    ])
  })

  test('a minimized level contributes no box', () => {
    const rects = chainHighlightRects({
      ...ctx,
      tracks: [{ minimized: false }, { minimized: true }, { minimized: false }],
      chunk: [
        entry('a', 'chr1', 0, [10, 5, 60, 15]),
        entry('b', 'chr2', 1, [20, 5, 70, 15]),
      ],
    })
    expect(rects.map(r => r.key)).toEqual(['0-a'])
  })

  test('a refName the assembly does not know is dropped, not drawn somewhere', () => {
    const rects = chainHighlightRects({
      ...ctx,
      chunk: [
        entry('a', 'chr1', 0, [10, 5, 60, 15]),
        entry('b', 'unknown', 1, [20, 5, 70, 15]),
      ],
    })
    expect(rects.map(r => r.key)).toEqual(['0-a'])
  })

  test('an off-display segment is left to its bottom-edge connector', () => {
    const rects = chainHighlightRects({
      ...ctx,
      chunk: [
        entry('a', 'chr1', 0, [10, 5, 60, 15]),
        entry('b', 'chr2', 1, makeOffscreenLayout(20, 70)),
      ],
    })
    expect(rects.map(r => r.key)).toEqual(['0-a'])
  })
})

describe('isDrawnByPileup', () => {
  const level = (linksReads: boolean): OverlayLevel => ({
    yOffset: 0,
    height: 100,
    coverageOffset: 0,
    scrollTop: 0,
    offsetPx: 0,
    linksReads,
  })
  const laidOut: LayoutRecord = [10, 20, 30, 25]

  test('a linked-reads level draws its own laid-out junctions', () => {
    expect(
      isDrawnByPileup({
        level: 0,
        levels: [level(true)],
        c1: laidOut,
        c2: laidOut,
      }),
    ).toBe(true)
  })

  test('an unlinked level draws nothing itself', () => {
    expect(
      isDrawnByPileup({
        level: 0,
        levels: [level(false)],
        c1: laidOut,
        c2: laidOut,
      }),
    ).toBe(false)
  })

  test('an off-display segment gets no connecting line, so the overlay keeps it', () => {
    const off = makeOffscreenLayout(10, 30)
    expect(
      isDrawnByPileup({
        level: 0,
        levels: [level(true)],
        c1: laidOut,
        c2: off,
      }),
    ).toBe(false)
    expect(
      isDrawnByPileup({
        level: 0,
        levels: [level(true)],
        c1: off,
        c2: laidOut,
      }),
    ).toBe(false)
  })

  test("reads the junction level's own flag, not another level's", () => {
    expect(
      isDrawnByPileup({
        level: 1,
        levels: [level(true), level(false)],
        c1: laidOut,
        c2: laidOut,
      }),
    ).toBe(false)
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
