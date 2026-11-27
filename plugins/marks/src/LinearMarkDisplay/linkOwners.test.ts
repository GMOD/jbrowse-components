import { LINK_ELSEWHERE, LINK_NO_REGION } from '@jbrowse/render-core/marks'

import {
  createLinkOwners,
  mateRegionsOf,
  withMateRegions,
} from './linkOwners.ts'

import type { MarkRegionData } from './markList.ts'

const A = { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' }
const B = { refName: 'ctgB', start: 0, end: 6000, assemblyName: 'volvox' }

const ALIASES: Record<string, string> = { chrA: 'ctgA', chrB: 'ctgB' }
const canonical = (_assembly: string, name: string) => ALIASES[name] ?? name

function payload(
  links: { x: number; x2: number; ref: string; region: number }[],
): MarkRegionData {
  const refs = [...new Set(links.map(l => l.ref))]
  return {
    layers: [
      {
        count: links.length,
        skipped: 0,
        x: Uint32Array.from(links, l => l.x),
        x2: Uint32Array.from(links, l => l.x2),
        x2Ref: Uint32Array.from(links, l => refs.indexOf(l.ref)),
        x2RefNames: refs,
        x2CanonicalRefNames: refs.map(name => canonical('volvox', name)),
        x2Region: Uint32Array.from(links, l => l.region),
        color: new Uint32Array(links.length),
        featureIndex: Uint32Array.from(links, (_, i) => i),
        yMin: Infinity,
        yMax: -Infinity,
      },
    ],
  }
}

const lane = (map: ReadonlyMap<number, MarkRegionData>, key: number) => [
  ...map.get(key)!.layers[0]!.x2Region!,
]

test('a pair whose two ends both have records draws from one region', () => {
  const owners = createLinkOwners()
  const out = owners(
    new Map([
      [0, payload([{ x: 21681, x2: 1982, ref: 'ctgB', region: 1 }])],
      [1, payload([{ x: 1982, x2: 21681, ref: 'ctgA', region: 0 }])],
    ]),
    [A, B],
  )
  expect(lane(out, 0)).toEqual([1])
  expect(lane(out, 1)).toEqual([LINK_ELSEWHERE])
})

test('the two halves pair through the assembly aliases', () => {
  const out = createLinkOwners()(
    new Map([
      [0, payload([{ x: 100, x2: 200, ref: 'chrB', region: 1 }])],
      [1, payload([{ x: 200, x2: 100, ref: 'ctgA', region: 0 }])],
    ]),
    [A, B],
  )
  expect([lane(out, 0), lane(out, 1)]).toEqual([[1], [LINK_ELSEWHERE]])
})

test('a pair spelt through an alias inside one region draws once', () => {
  const out = createLinkOwners()(
    new Map([
      [
        0,
        payload([
          { x: 100, x2: 200, ref: 'chrA', region: 0 },
          { x: 200, x2: 100, ref: 'ctgA', region: 0 },
          { x: 300, x2: 400, ref: 'ctgA', region: 0 },
        ]),
      ],
    ]),
    [A],
  )
  expect(lane(out, 0)).toEqual([0, LINK_ELSEWHERE, 0])
})

test('a record with no partner draws whole from its own region, the far one loaded or not', () => {
  const out = createLinkOwners()(
    new Map([
      [0, payload([{ x: 100, x2: 3000, ref: 'ctgB', region: 1 }])],
      [1, payload([])],
    ]),
    [A, B],
  )
  expect(lane(out, 0)).toEqual([1])
  const alone = createLinkOwners()(
    new Map([
      [1, payload([{ x: 3000, x2: 5, ref: 'ctgC', region: LINK_NO_REGION }])],
    ]),
    [A, B],
  )
  expect(lane(alone, 1)).toEqual([LINK_NO_REGION])
})

test('one record fetched into two regions draws from the region holding its foot', () => {
  const left = { ...A, end: 1000 }
  const right = { ...A, start: 1000, end: 2000 }
  const del = { x: 500, x2: 1500, ref: 'ctgA' }
  const out = createLinkOwners()(
    new Map([
      [1, payload([{ ...del, region: 1 }])],
      [0, payload([{ ...del, region: 1 }])],
    ]),
    [left, right],
  )
  expect([lane(out, 0), lane(out, 1)]).toEqual([[1], [LINK_ELSEWHERE]])
})

test('the same feet on two assemblies are two curves, and both draw', () => {
  const hg38 = { ...A, refName: 'chr1', assemblyName: 'hg38' }
  const hs1 = { ...hg38, assemblyName: 'hs1' }
  const out = createLinkOwners()(
    new Map([
      [0, payload([{ x: 100, x2: 900, ref: 'chr1', region: 0 }])],
      [1, payload([{ x: 100, x2: 900, ref: 'chr1', region: 1 }])],
    ]),
    [hg38, hs1],
  )
  expect([lane(out, 0), lane(out, 1)]).toEqual([[0], [1]])
})

test('a pair across two assemblies draws from one region', () => {
  const hg38 = { ...A, refName: 'chr1', assemblyName: 'hg38' }
  const hs1 = { ...hg38, assemblyName: 'hs1' }
  const out = createLinkOwners()(
    new Map([
      [0, payload([{ x: 100, x2: 900, ref: 'chr1', region: 1 }])],
      [1, payload([{ x: 900, x2: 100, ref: 'chr1', region: 0 }])],
    ]),
    [hg38, hs1],
  )
  expect([lane(out, 0), lane(out, 1)]).toEqual([[1], [LINK_ELSEWHERE]])
})

test('a pair across two assemblies that spell a contig differently draws once', () => {
  const q = { refName: '1', start: 0, end: 1000, assemblyName: 'Q' }
  const p1 = { refName: 'chr1', start: 0, end: 1000, assemblyName: 'P' }
  const p2 = { refName: 'chr2', start: 0, end: 1000, assemblyName: 'P' }
  const out = createLinkOwners()(
    new Map([
      [0, payload([{ x: 500, x2: 100, ref: 'chr2', region: 2 }])],
      [1, payload([{ x: 500, x2: 100, ref: 'chr2', region: 2 }])],
      [2, payload([{ x: 100, x2: 500, ref: 'chr1', region: 0 }])],
    ]),
    [q, p1, p2],
  )
  expect([lane(out, 0), lane(out, 1), lane(out, 2)]).toEqual([
    [2],
    [2],
    [LINK_ELSEWHERE],
  ])
})

test('a region whose drawn set did not move keeps its payload', () => {
  const owners = createLinkOwners()
  const a = payload([{ x: 100, x2: 3000, ref: 'ctgB', region: 1 }])
  const first = owners(new Map([[0, a]]), [A, B])
  const second = owners(
    new Map([
      [0, a],
      [1, payload([{ x: 5000, x2: 7, ref: 'ctgB', region: 1 }])],
    ]),
    [A, B],
  )
  expect(second.get(0)).toBe(first.get(0))
})

test('the same feet in two rows are two curves, and both draw', () => {
  const data = payload([
    { x: 100, x2: 900, ref: 'ctgA', region: 0 },
    { x: 100, x2: 900, ref: 'ctgA', region: 0 },
    { x: 100, x2: 900, ref: 'ctgA', region: 0 },
  ])
  data.layers[0]!.row = Uint32Array.of(0, 1, 1)
  const out = createLinkOwners()(new Map([[0, data]]), [A])
  expect(lane(out, 0)).toEqual([0, 0, LINK_ELSEWHERE])
})

test('raw aliased feet read through withMateRegions pair across two regions and draw once inside one', () => {
  const regions = [
    { ...A, index: 0 },
    { ...B, index: 1 },
  ]
  const raw = (
    links: { x: number; x2: number; ref: string }[],
    index: number,
  ) => {
    const { x2CanonicalRefNames: _names, ...layer } = payload(
      links.map(l => ({ ...l, region: 0 })),
    ).layers[0]!
    return withMateRegions({ layers: [layer] }, regions, canonical, index)
  }
  const across = createLinkOwners()(
    new Map([
      [0, raw([{ x: 100, x2: 200, ref: 'chrB' }], 0)],
      [1, raw([{ x: 200, x2: 100, ref: 'chrA' }], 1)],
    ]),
    [A, B],
  )
  expect([lane(across, 0), lane(across, 1)]).toEqual([[1], [LINK_ELSEWHERE]])
  const inside = createLinkOwners()(
    new Map([
      [
        0,
        raw(
          [
            { x: 100, x2: 200, ref: 'chrA' },
            { x: 200, x2: 100, ref: 'ctgA' },
          ],
          0,
        ),
      ],
    ]),
    [A],
  )
  expect(lane(inside, 0)).toEqual([0, LINK_ELSEWHERE])
})

test("a far foot past its own region's edge stays on the track's assembly when another assembly shows its contig there", () => {
  const displayed = [
    { refName: 'chr1', start: 80, end: 1000, assemblyName: 'hg38' },
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hs1' },
  ]
  const { x2CanonicalRefNames: _names, ...layer } = payload([
    { x: 100, x2: 50, ref: 'chr1', region: 0 },
  ]).layers[0]!
  const placed = withMateRegions(
    { layers: [layer] },
    mateRegionsOf(displayed, assemblyName => assemblyName === 'hg38'),
    canonical,
    0,
  ).layers[0]!
  expect([...placed.x2Region!]).toEqual([0])
  expect(placed.x2CanonicalRefNames).toEqual(['chr1'])
})
