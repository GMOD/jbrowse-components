import { types } from '@jbrowse/mobx-state-tree'

import {
  breakendKeepsDirections,
  breakendTickPx,
  getBreakendCoveringRegions,
  getBreakendMateLocString,
  hasBreakpointSplitView,
  parseSvAlt,
  readTranslocationMate,
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
    getCanonicalRefName2: (ref: string) => ref,
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
      end: 150,
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

    expect(result.pos).toBe(150)
    expect(result.refName).toBe('chr1')
    expect(result.mateRefName).toBe('chr2')
    expect(result.matePos).toBe(200)
  })

  // The junction-facing edge of each footprint, which is the edge the connector
  // in `PairedFeatures` actually attaches to. A 6-8 column BEDPE has no strand
  // columns at all, so `parseStrand` answers 0 for both sides, and 0 has to read
  // as forward here exactly as `readTrailingBp`/`readLeadingBp` read it -- that
  // pair keys on `=== -1` so a strandless record cannot make the two ends
  // disagree about which way they face.
  test.each([
    { name: 'strandless (a 6-8 column bedpe)', strand: 0, mateStrand: 0 },
    { name: 'explicitly forward', strand: 1, mateStrand: 1 },
  ])('faces the junction when $name', ({ strand, mateStrand }) => {
    const feature = createMockFeature({
      ALT: undefined,
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand,
      mate: { refName: 'chr5', start: 50000, end: 51000, strand: mateStrand },
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect({ pos: result.pos, matePos: result.matePos }).toEqual({
      pos: 2000,
      matePos: 50000,
    })
  })

  test('a reverse-stranded pair faces the junction from the other edge', () => {
    const feature = createMockFeature({
      ALT: undefined,
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: -1,
      mate: { refName: 'chr5', start: 50000, end: 51000, strand: -1 },
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect({ pos: result.pos, matePos: result.matePos }).toEqual({
      pos: 1000,
      matePos: 51000,
    })
  })

  test('a mate without an end column still resolves a position', () => {
    const feature = createMockFeature({
      ALT: undefined,
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: -1,
      mate: { refName: 'chr5', start: 50000, strand: -1 },
    })
    const result = getBreakendCoveringRegions({
      feature: feature as any,
      assembly: createMockAssembly(),
    })

    expect(result.matePos).toBe(50000)
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

describe('parseSvAlt tick directions', () => {
  // The four bracket forms of VCF 4.3 s5.4, for a record at 13:123456 REF C
  // with mate 2:321682, written out rather than remembered: the ALT's shape
  // says which side of each breakpoint the derivative KEEPS, and both
  // directions are that side (1 = right, -1 = left). The ref base's position in
  // the ALT gives this end -- leading C means the piece is joined after it, so
  // this end keeps its left -- and the bracket gives the mate's, `[` right and
  // `]` left.
  const forms = [
    { alt: 'C[2:321682[', joinDirection: -1, mateDirection: 1 },
    { alt: 'C]2:321682]', joinDirection: -1, mateDirection: -1 },
    { alt: ']2:321682]C', joinDirection: 1, mateDirection: -1 },
    { alt: '[2:321682[C', joinDirection: 1, mateDirection: 1 },
  ]

  test.each(forms)('$alt', ({ alt, joinDirection, mateDirection }) => {
    const feature = createMockFeature({
      ALT: [alt],
      start: 123455,
      refName: '13',
    })
    expect(parseSvAlt(feature as any, alt)).toEqual({
      mateRefName: '2',
      matePos: 321682,
      joinDirection,
      mateDirection,
    })
  })

  test('a symbolic allele states no direction', () => {
    const feature = createMockFeature({
      ALT: ['<DEL>'],
      start: 100,
      refName: 'chr1',
      INFO: { END: [200] },
    })
    const parsed = parseSvAlt(feature as any, '<DEL>')
    expect(parsed?.joinDirection).toBeUndefined()
    expect(parsed?.mateDirection).toBeUndefined()
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

// A refName may contain a colon, so the separator is the LAST one. GRCh38's
// full analysis set names its HLA contigs `HLA-A*01:01:01:01`, which reaches
// here as `HLA-A*01:01:01:01:1000` — split at the first colon that read as
// `HLA-A*01` at position 1, a contig-and-locus a panel then opened on.
describe('parseSvAlt with a colon in the mate refName', () => {
  test('keeps the whole contig name and the real position', () => {
    const alt = 'C[HLA-A*01:01:01:01:1000['
    const feature = createMockFeature({
      ALT: [alt],
      start: 123455,
      refName: '13',
    })
    expect(parseSvAlt(feature as any, alt)).toEqual({
      mateRefName: 'HLA-A*01:01:01:01',
      matePos: 1000,
      joinDirection: -1,
      mateDirection: 1,
    })
  })

  test('refuses a mate position that is not a number', () => {
    // A NaN here reaches a fetch region and a panel's `centerAt`, neither of
    // which says anything about it.
    const alt = 'C[chr2:notaposition['
    const feature = createMockFeature({
      ALT: [alt],
      start: 123455,
      refName: '13',
    })
    expect(parseSvAlt(feature as any, alt)).toBeUndefined()
  })

  // `Number` is too generous to screen a position on, and screening on
  // `Number.isFinite` alone let all four of these through as real locations —
  // `''` parses to 0, which reaches `svMateLocus` as -1.
  test.each([
    ['an empty position', 'C[chr2:['],
    ['a negative position', 'C[chr2:-5['],
    ['a fractional position', 'C[chr2:100.7['],
    ['a hexadecimal position', 'C[chr2:0x10['],
    ['position zero, which is not 1-based', 'C[chr2:0['],
  ])('refuses %s', (_, alt) => {
    const feature = createMockFeature({
      ALT: [alt],
      start: 123455,
      refName: '13',
    })
    expect(parseSvAlt(feature as any, alt)).toBeUndefined()
  })
})

// The four ALT forms with, stated independently of the implementation, which
// screen side each end's tick must point at. `keeps` is VCF 4.3 §5.4: the piece
// a `t[q[` record keeps runs LEFT from its breakpoint, and its mate's runs
// RIGHT. On an unflipped view genomic-right is screen-right; a reversed region
// mirrors the axis, so every expectation below inverts with it — which is the
// whole content of the claim.
const TICK_FORMS = [
  { alt: 'C[2:321682[', thisKeeps: 'left', mateKeeps: 'right' },
  { alt: 'C]2:321682]', thisKeeps: 'left', mateKeeps: 'left' },
  { alt: ']2:321682]C', thisKeeps: 'right', mateKeeps: 'left' },
  { alt: '[2:321682[C', thisKeeps: 'right', mateKeeps: 'right' },
] as const

describe('breakendTickPx', () => {
  const X = 100

  // `C[2:321682[` and `]2:321682]C` are the asymmetric forms — their two ends
  // keep opposite sides. A symmetric-only table would pass an implementation
  // that negated both ends, since negating a symmetric pair is a no-op.
  test.each(TICK_FORMS)(
    '$alt points each end at the side it keeps',
    ({ alt, thisKeeps, mateKeeps }) => {
      const bnd = safeParseBreakend(alt)!
      const { joinDirection, mateDirection } = breakendKeepsDirections(bnd)

      for (const [dir, keeps] of [
        [joinDirection, thisKeeps],
        [mateDirection, mateKeeps],
      ] as const) {
        expect(breakendTickPx(X, dir, false) - X).toBe(
          keeps === 'right' ? 20 : -20,
        )
        // The same end, on a horizontally flipped view.
        expect(breakendTickPx(X, dir, true) - X).toBe(
          keeps === 'right' ? -20 : 20,
        )
      }
    },
  )

  test('agrees with what parseSvAlt reports for the same record', () => {
    for (const { alt } of TICK_FORMS) {
      const feature = createMockFeature({ ALT: [alt], start: 1, refName: '13' })
      const parsed = parseSvAlt(feature as any, alt)!
      expect(breakendKeepsDirections(safeParseBreakend(alt)!)).toEqual({
        joinDirection: parsed.joinDirection,
        mateDirection: parsed.mateDirection,
      })
    }
  })
})

// STRANDS names the strand a translocation end is ON; a `+` end keeps the
// sequence to its left, so the keeps-direction is the negation. Getting this
// backwards points both ticks at the pieces the record discards.
describe('readTranslocationMate keeps-directions', () => {
  test.each([
    ['+-', -1, 1],
    ['-+', 1, -1],
    ['++', -1, -1],
    ['--', 1, 1],
  ])('STRANDS %s', (strands, myKeepsDir, mateKeepsDir) => {
    expect(
      readTranslocationMate({
        CHR2: ['chr2'],
        END: [100],
        STRANDS: [strands],
      }),
    ).toMatchObject({ myKeepsDir, mateKeepsDir })
  })

  test('an unknown strand char keeps neither side', () => {
    expect(readTranslocationMate({ CHR2: ['chr2'], END: [100] })).toMatchObject(
      { myKeepsDir: 0, mateKeepsDir: 0 },
    )
  })
})
