import {
  laneGenesFetchSpecsOf,
  laneGroupsFetchSpecsOf,
  laneLinksFetchSpecsOf,
  regionKey,
} from './laneFetch.ts'

import type { LaneWindow } from './laneFetch.ts'

function windowOn(assemblyName: string): LaneWindow {
  const regions = [{ assemblyName, refName: 'chr1', start: 0, end: 100 }]
  return { regions, templateRegions: regions, bpPerPx: 1 }
}

const windows = new Map([
  ['anchor', windowOn('anchor')],
  ['a', windowOn('a')],
  ['b', windowOn('b')],
  ['c', windowOn('c')],
])
const pairs = [
  { upper: 'a', lower: 'b', key: 'a|b' },
  { upper: 'b', lower: 'c', key: 'b|c' },
]

describe('laneLinksFetchSpecsOf', () => {
  const inputs = {
    pairs,
    windows,
    rowFrames: new Map([
      ['a', {}],
      ['b', {}],
      ['c', {}],
    ]),
    anchor: 'anchor',
    onAnchor: false,
    lodTier: 'fine' as const,
    nearViewport: () => true,
  }

  test('a pair reads the upper lane’s window and keys on the tier', () => {
    const [spec] = laneLinksFetchSpecsOf(inputs)
    expect(spec).toMatchObject({
      lane: 'a|b',
      assemblyName: 'a',
      lowerAssembly: 'b',
      onAnchor: false,
      key: `${regionKey(windows.get('a')!.regions[0]!)}|fine`,
    })
  })

  test('a pair whose gutter is off screen has no spec', () => {
    const specs = laneLinksFetchSpecsOf({
      ...inputs,
      nearViewport: upperRow => upperRow === 2,
    })
    expect(specs.map(s => s.lane)).toEqual(['b|c'])
  })

  test('a pair with a lane that has no window has no spec', () => {
    const missing = new Map(windows)
    missing.delete('b')
    expect(laneLinksFetchSpecsOf({ ...inputs, windows: missing })).toEqual([])
  })

  test('on the anchor, the anchor’s window serves the pair once both rows are framed', () => {
    const onAnchor = { ...inputs, onAnchor: true }
    const [spec] = laneLinksFetchSpecsOf(onAnchor)
    expect(spec!.regions).toEqual(windows.get('anchor')!.regions)
    expect(
      laneLinksFetchSpecsOf({ ...onAnchor, rowFrames: new Map([['a', {}]]) }),
    ).toEqual([])
  })
})

describe('laneGroupsFetchSpecsOf', () => {
  test('each lane with a window reads it', () => {
    const specs = laneGroupsFetchSpecsOf(['a', 'x', 'c'], windows, 'coarse')
    expect(specs.map(s => [s.lane, s.lodTier])).toEqual([
      ['a', 'coarse'],
      ['c', 'coarse'],
    ])
  })
})

describe('laneGenesFetchSpecsOf', () => {
  const adapter = { type: 'Gff3TabixAdapter' }

  test('a lane without an adapter has no spec', () => {
    expect(
      laneGenesFetchSpecsOf({
        windows,
        adapters: new Map([['a', adapter]]),
        tracks: new Map(),
      }).map(s => s.lane),
    ).toEqual(['a'])
  })

  test('with no track entry the spec keys on the adapter itself', () => {
    const [spec] = laneGenesFetchSpecsOf({
      windows,
      adapters: new Map([['a', adapter]]),
      tracks: new Map(),
    })
    expect(spec!.key.startsWith(`adapter:${JSON.stringify(adapter)}@`)).toBe(
      true,
    )
  })

  test("a lane reads its gene track's filter, and a new filter refetches", () => {
    const specsWith = (filter: string[]) =>
      laneGenesFetchSpecsOf({
        windows,
        adapters: new Map([['a', adapter]]),
        tracks: new Map([
          [
            'a',
            {
              trackId: 'genes',
              type: 'FeatureTrack',
              displays: [{ type: 'LinearBasicDisplay', filter }],
            },
          ],
        ]),
      })[0]!
    const coding = ["jexl:get(feature,'gene_biotype')=='protein_coding'"]
    expect(specsWith(coding).filter).toEqual(coding)
    expect(specsWith(coding).key).not.toBe(specsWith([]).key)
  })
})
