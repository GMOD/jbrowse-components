import { makeOffscreenLayout } from '../util.ts'
import {
  buildBreakpointPath,
  buildSimplePath,
  isDrawnByPileup,
  resolvedPairs,
  strandToSign,
} from './overlayUtils.tsx'

import type { LayoutMatch, LayoutRecord, OverlayLevel } from '../types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

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
