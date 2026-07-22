import {
  featureMatchesHighlight,
  featureNameMatchesHighlight,
  resolveFeatureHighlights,
  warnUnresolvedHighlights,
} from './featureHighlight.ts'

import type { FeatureHighlight } from './featureHighlight.ts'

const gene: FeatureHighlight = {
  refName: 'chr1',
  start: 1000,
  end: 2000,
  name: 'BRCA1',
}

test('exact span matches regardless of the stored label', () => {
  expect(
    featureMatchesHighlight({ startBp: 1000, endBp: 2000 }, 'chr1', gene),
  ).toBe(true)
})

test('off-by-one span (base convention drift) still matches', () => {
  expect(
    featureMatchesHighlight({ startBp: 999, endBp: 2000 }, 'chr1', gene),
  ).toBe(true)
})

test('an overlapping but non-exact span does not match (no overlap fallback)', () => {
  // previously rescued by a matching name; text search now resolves by span
  // alone, so a nested/overlapping feature no longer gets swept in
  expect(
    featureMatchesHighlight({ startBp: 1200, endBp: 1800 }, 'chr1', gene),
  ).toBe(false)
})

test('a non-overlapping span (paralog elsewhere) does not match', () => {
  expect(
    featureMatchesHighlight({ startBp: 50000, endBp: 51000 }, 'chr1', gene),
  ).toBe(false)
})

test('wrong refName never matches', () => {
  expect(
    featureMatchesHighlight({ startBp: 1000, endBp: 2000 }, 'chr2', gene),
  ).toBe(false)
})

describe('warnUnresolvedHighlights', () => {
  const region = {
    refName: 'chr1',
    flatbushItems: [{ startBp: 100, endBp: 200, featureId: 'f1' }],
    subfeatureInfos: [],
  }
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it('warns when a highlight matches nothing', () => {
    // 7bp past the real end — the mistake a hand-written spec actually makes
    const h = [{ refName: 'chr1', start: 100, end: 207, name: 'KRAS' }]
    warnUnresolvedHighlights(h, resolveFeatureHighlights([region], h), true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('chr1:100-207')
    expect(warn.mock.calls[0]![0]).toContain('KRAS')
  })

  it('warns only once for the same highlight', () => {
    const h = [{ refName: 'chr1', start: 300, end: 400, name: 'TP53' }]
    warnUnresolvedHighlights(h, resolveFeatureHighlights([region], h), true)
    warnUnresolvedHighlights(h, resolveFeatureHighlights([region], h), true)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('stays silent when the highlight resolves', () => {
    const h = [{ refName: 'chr1', start: 100, end: 200 }]
    warnUnresolvedHighlights(h, resolveFeatureHighlights([region], h), true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent before any data has loaded', () => {
    const h = [{ refName: 'chr1', start: 500, end: 600 }]
    warnUnresolvedHighlights(h, resolveFeatureHighlights([], h), false)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('name fallback', () => {
  const region = {
    refName: 'chr12',
    flatbushItems: [
      { startBp: 25205245, endBp: 25250929, featureId: 'kras', name: 'KRAS' },
      { startBp: 30000000, endBp: 30001000, featureId: 'other', name: 'BCAT1' },
    ],
    subfeatureInfos: [],
  }

  it('rescues a highlight whose span is off by more than 1bp', () => {
    // the real KRAS bug: end 7bp past the track's own record
    const h = [
      { refName: 'chr12', start: 25205245, end: 25250936, name: 'KRAS' },
    ]
    expect([...resolveFeatureHighlights([region], h).box]).toEqual(['kras'])
  })

  it('matches on name alone, with no coordinates at all', () => {
    const h = [{ refName: 'chr12', name: 'KRAS' }]
    expect([...resolveFeatureHighlights([region], h).box]).toEqual(['kras'])
  })

  it('is case insensitive', () => {
    const h = [{ refName: 'chr12', name: 'kras' }]
    expect([...resolveFeatureHighlights([region], h).box]).toEqual(['kras'])
  })

  it('does not fall back when the span already matched', () => {
    // span points at BCAT1 while the name says KRAS; the span wins outright,
    // so a stale name can never drag in a second feature
    const h = [
      { refName: 'chr12', start: 30000000, end: 30001000, name: 'KRAS' },
    ]
    expect([...resolveFeatureHighlights([region], h).box]).toEqual(['other'])
  })

  it('is scoped to the highlight refName', () => {
    const h = [{ refName: 'chr9', name: 'KRAS' }]
    expect([...resolveFeatureHighlights([region], h).box]).toEqual([])
  })

  it('boxes every feature sharing an ambiguous name (documented trade)', () => {
    const dup = {
      refName: 'chr12',
      flatbushItems: [
        { startBp: 1, endBp: 2, featureId: 'a', name: 'DUP' },
        { startBp: 90, endBp: 99, featureId: 'b', name: 'DUP' },
      ],
      subfeatureInfos: [],
    }
    const h = [{ refName: 'chr12', name: 'DUP' }]
    expect([...resolveFeatureHighlights([dup], h).box].sort()).toEqual(['a', 'b'])
  })

  it('falls back to a subfeature name and pins its parent', () => {
    const withSub = {
      refName: 'chr12',
      flatbushItems: [
        { startBp: 1, endBp: 1000, featureId: 'gene', name: 'GENE' },
      ],
      subfeatureInfos: [
        {
          featureId: 'tx',
          parentFeatureId: 'gene',
          startBp: 10,
          endBp: 900,
          displayLabel: 'GENE-201',
        },
      ],
    }
    const r = resolveFeatureHighlights([withSub], [
      { refName: 'chr12', name: 'GENE-201' },
    ])
    expect([...r.box]).toEqual(['tx'])
    expect([...r.pin]).toEqual(['gene'])
  })

  it('featureNameMatchesHighlight ignores an item with no name', () => {
    expect(
      featureNameMatchesHighlight({ startBp: 1, endBp: 2 }, 'chr12', {
        refName: 'chr12',
        name: 'KRAS',
      }),
    ).toBe(false)
  })

  it('never name-falls-back for a right-click (featureId) highlight', () => {
    // a stale featureId must resolve to nothing rather than boxing every
    // same-named sibling — the regression 5153e76cee fixed
    const dup = {
      refName: 'chr12',
      flatbushItems: [
        { startBp: 1, endBp: 2, featureId: 'a', name: 'DUP' },
        { startBp: 90, endBp: 99, featureId: 'b', name: 'DUP' },
      ],
      subfeatureInfos: [],
    }
    const h = [{ refName: 'chr12', name: 'DUP', featureId: 'gone' }]
    expect([...resolveFeatureHighlights([dup], h).box]).toEqual([])
  })
})
