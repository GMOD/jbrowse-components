import { types } from '@jbrowse/mobx-state-tree'

import {
  getBreakendCoveringRegions,
  getBreakendMateLocString,
  hasBreakpointSplitView,
  safeParseBreakend,
  splitRegionAtPosition,
} from './util.ts'

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

describe('getBreakendMateLocString', () => {
  const locStringOf = (alt: string) =>
    getBreakendMateLocString(safeParseBreakend(alt))

  test('bracket notation yields the mate locString', () => {
    expect(locStringOf('N[chr2:201[')).toBe('chr2:201')
    expect(locStringOf(']chr2:201]N')).toBe('chr2:201')
  })

  test('a single breakend has no mate', () => {
    expect(locStringOf('.A')).toBeUndefined()
    expect(locStringOf('G.')).toBeUndefined()
  })

  test('the symbolic-mate forms name no contig', () => {
    // parseBreakend answers these with a '<DEL>:1' placeholder
    expect(locStringOf('G<DEL>')).toBeUndefined()
    expect(locStringOf('<DEL>G')).toBeUndefined()
  })

  test('a plain allele is not a breakend', () => {
    expect(locStringOf('A')).toBeUndefined()
    expect(locStringOf('<DEL>')).toBeUndefined()
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

// Every launch site calls this from a display or widget — a node *inside* the
// session — except the spreadsheet's FeatureMenu, which already holds the
// session and passes that. Resolving through `getSession` served the first
// group and threw `no session model found!` for the second, during render, so
// the gate meant to remove one menu item removed the menu.
describe('hasBreakpointSplitView', () => {
  function tree(viewTypes: string[]) {
    const Child = types.model('Child', {
      id: types.optional(types.string, 'c'),
    })
    const Session = types
      .model('Session', {
        // half of what core's isSessionModel keys off; `rpcManager` is the
        // other half and is a view, since a session's is not a property
        configuration: types.optional(types.frozen(), {}),
        child: types.optional(Child, {}),
      })
      .views(() => ({
        get rpcManager() {
          return {}
        },
      }))
    const session = Session.create(
      {},
      { pluginManager: { viewTypes: new Map(viewTypes.map(v => [v, {}])) } },
    )
    return { session, child: session.child }
  }

  test('resolves from a node inside the session', () => {
    const { child } = tree(['BreakpointSplitView'])
    expect(hasBreakpointSplitView(child)).toBe(true)
  })

  test('resolves from the session itself, which has no session ancestor', () => {
    const { session } = tree(['BreakpointSplitView'])
    expect(hasBreakpointSplitView(session)).toBe(true)
  })

  test('is false when the view type is not registered', () => {
    const { session, child } = tree(['LinearGenomeView'])
    expect(hasBreakpointSplitView(session)).toBe(false)
    expect(hasBreakpointSplitView(child)).toBe(false)
  })
})
