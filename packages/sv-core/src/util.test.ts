import { getBreakendCoveringRegions, splitRegionAtPosition } from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

function createMockFeature(data: Record<string, unknown>) {
  return {
    get: (key: string) => data[key],
  }
}

function createMockAssembly(): Assembly {
  return {
    getCanonicalRefName: (ref: string) => ref,
  } as Assembly
}

describe('getBreakendCoveringRegions', () => {
  test('handles TRA alt allele', () => {
    const feature = createMockFeature({
      ALT: ['<TRA>'],
      start: 100,
      refName: 'chr1',
      INFO: {
        CHR2: ['chr2'],
        END: [201],
      },
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect(result.pos).toBe(100)
    expect(result.refName).toBe('chr1')
    expect(result.mateRefName).toBe('chr2')
    expect(result.matePos).toBe(200)
  })

  test('handles breakend notation with MatePosition', () => {
    const feature = createMockFeature({
      ALT: ['N[chr2:201['],
      start: 100,
      refName: 'chr1',
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect(result.pos).toBe(100)
    expect(result.refName).toBe('chr1')
    expect(result.mateRefName).toBe('chr2')
    expect(result.matePos).toBe(200)
  })

  test('handles mate property', () => {
    const feature = createMockFeature({
      ALT: undefined,
      start: 100,
      refName: 'chr1',
      mate: {
        refName: 'chr2',
        start: 200,
      },
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect(result.pos).toBe(100)
    expect(result.refName).toBe('chr1')
    expect(result.mateRefName).toBe('chr2')
    expect(result.matePos).toBe(200)
  })

  test('falls back to feature end for non-breakend features', () => {
    const feature = createMockFeature({
      ALT: undefined,
      start: 100,
      end: 500,
      refName: 'chr1',
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect(result.pos).toBe(100)
    expect(result.refName).toBe('chr1')
    expect(result.mateRefName).toBe('chr1')
    expect(result.matePos).toBe(500)
  })
})

describe('splitRegionAtPosition', () => {
  test('splits region at position correctly', () => {
    const region = { refName: 'chr1', start: 0, end: 1000 }
    const [left, right] = splitRegionAtPosition(region, 500)

    expect(left.start).toBe(0)
    expect(left.end).toBe(501)
    expect(right.start).toBe(500)
    expect(right.end).toBe(1000)
  })

  test('both regions include the breakend position', () => {
    const region = { refName: 'chr1', start: 0, end: 1000 }
    const pos = 500
    const [left, right] = splitRegionAtPosition(region, pos)

    expect(left.end).toBeGreaterThan(pos)
    expect(right.start).toBeLessThanOrEqual(pos)
  })

  test('preserves refName from original region', () => {
    const region = { refName: 'chr2', start: 100, end: 200 }
    const [left, right] = splitRegionAtPosition(region, 150)

    expect(left.refName).toBe('chr2')
    expect(right.refName).toBe('chr2')
  })

  test('adds assemblyName when provided', () => {
    const region = { refName: 'chr1', start: 0, end: 1000 }
    const [left, right] = splitRegionAtPosition(region, 500, 'hg38')

    expect(left.assemblyName).toBe('hg38')
    expect(right.assemblyName).toBe('hg38')
  })

  test('does not add assemblyName when not provided', () => {
    const region = { refName: 'chr1', start: 0, end: 1000 }
    const [left, right] = splitRegionAtPosition(region, 500)

    expect(left.assemblyName).toBeUndefined()
    expect(right.assemblyName).toBeUndefined()
  })

  test('preserves additional properties from original region', () => {
    const region = { refName: 'chr1', start: 0, end: 1000, reversed: true }
    const [left, right] = splitRegionAtPosition(region, 500)

    expect(left.reversed).toBe(true)
    expect(right.reversed).toBe(true)
  })

  test('handles position at start of region', () => {
    const region = { refName: 'chr1', start: 0, end: 1000 }
    const [left, right] = splitRegionAtPosition(region, 0)

    expect(left.start).toBe(0)
    expect(left.end).toBe(1)
    expect(right.start).toBe(0)
    expect(right.end).toBe(1000)
  })

  test('handles position at end of region', () => {
    const region = { refName: 'chr1', start: 0, end: 1000 }
    const [left, right] = splitRegionAtPosition(region, 999)

    expect(left.start).toBe(0)
    expect(left.end).toBe(1000)
    expect(right.start).toBe(999)
    expect(right.end).toBe(1000)
  })
})
