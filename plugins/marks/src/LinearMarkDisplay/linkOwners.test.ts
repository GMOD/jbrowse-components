import { LINK_ELSEWHERE, LINK_NO_REGION } from '@jbrowse/render-core/marks'

import { createLinkOwners } from './linkOwners.ts'

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
    canonical,
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
    canonical,
  )
  expect([lane(out, 0), lane(out, 1)]).toEqual([[1], [LINK_ELSEWHERE]])
})

test('a record with no partner draws whole from its own region, the far one loaded or not', () => {
  const out = createLinkOwners()(
    new Map([
      [0, payload([{ x: 100, x2: 3000, ref: 'ctgB', region: 1 }])],
      [1, payload([])],
    ]),
    [A, B],
    canonical,
  )
  expect(lane(out, 0)).toEqual([1])
  const alone = createLinkOwners()(
    new Map([
      [1, payload([{ x: 3000, x2: 5, ref: 'ctgC', region: LINK_NO_REGION }])],
    ]),
    [A, B],
    canonical,
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
    canonical,
  )
  expect([lane(out, 0), lane(out, 1)]).toEqual([[1], [LINK_ELSEWHERE]])
})

test('a region whose drawn set did not move keeps its payload', () => {
  const owners = createLinkOwners()
  const a = payload([{ x: 100, x2: 3000, ref: 'ctgB', region: 1 }])
  const first = owners(new Map([[0, a]]), [A, B], canonical)
  const second = owners(
    new Map([
      [0, a],
      [1, payload([{ x: 5000, x2: 7, ref: 'ctgB', region: 1 }])],
    ]),
    [A, B],
    canonical,
  )
  expect(second.get(0)).toBe(first.get(0))
})
