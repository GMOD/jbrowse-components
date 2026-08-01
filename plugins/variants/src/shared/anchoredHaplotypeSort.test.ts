import {
  anchorOutwardSites,
  refineRowsBySite,
  sortSourcesAroundVariant,
} from './anchoredHaplotypeSort.ts'

import type { ProcessedSource } from './types.ts'

describe('anchorOutwardSites', () => {
  test('alternates outward from the anchor', () => {
    expect([...anchorOutwardSites(3, 7, 10)]).toEqual([3, 2, 4, 1, 5, 0, 6])
  })

  test('keeps going on the side that still has sites', () => {
    expect([...anchorOutwardSites(0, 4, 10)]).toEqual([0, 1, 2, 3])
    expect([...anchorOutwardSites(3, 4, 10)]).toEqual([3, 2, 1, 0])
  })

  test('stops at maxFlank', () => {
    expect([...anchorOutwardSites(3, 7, 1)]).toEqual([3, 2, 4])
  })

  test('yields nothing for an out-of-range anchor', () => {
    expect([...anchorOutwardSites(-1, 5, 10)]).toEqual([])
    expect([...anchorOutwardSites(5, 5, 10)]).toEqual([])
  })
})

describe('refineRowsBySite', () => {
  // rows × sites
  const grid = [
    [1, 1, 1], // a
    [0, 1, 0], // b
    [1, 0, 1], // c
    [1, 1, 0], // d
  ]
  const items = ['a', 'b', 'c', 'd']
  const readSite = (site: number) => (row: number) => grid[row]![site]!

  test('sorts by the anchor site first, alt-carrying rows leading', () => {
    expect(
      refineRowsBySite({ items, readSite, sites: [0], maxValue: 3 }),
    ).toEqual(['a', 'c', 'd', 'b'])
  })

  test('breaks anchor ties with the next site', () => {
    // at site 0 a/c/d tie at 1; site 1 splits c (0) from a and d (1)
    expect(
      refineRowsBySite({ items, readSite, sites: [0, 1], maxValue: 3 }),
    ).toEqual(['a', 'd', 'c', 'b'])
  })

  test('a later site cannot reorder rows an earlier site separated', () => {
    // site 2 would put c above d, but site 0/1 already ranked d above c
    expect(
      refineRowsBySite({ items, readSite, sites: [0, 1, 2], maxValue: 3 }),
    ).toEqual(['a', 'd', 'c', 'b'])
  })

  test('rows that never differ keep their input order', () => {
    expect(
      refineRowsBySite({
        items: ['x', 'y'],
        readSite: () => () => 1,
        sites: [0, 1],
        maxValue: 3,
      }),
    ).toEqual(['x', 'y'])
  })

  test('stops reading sites once every row is separated', () => {
    const distinct = [[3], [2], [1], [0]]
    const seen: number[] = []
    refineRowsBySite({
      items,
      readSite: site => {
        seen.push(site)
        return row => distinct[row]![0]!
      },
      sites: [0, 1, 2],
      maxValue: 3,
    })
    // the anchor already made every row unique, so no flanking site is read
    expect(seen.every(site => site === 0)).toBe(true)
  })

  test('keeps reading while any rows are still tied', () => {
    // a and d agree at sites 0 and 1 and only differ at site 2
    const seen: number[] = []
    refineRowsBySite({
      items,
      readSite: site => {
        seen.push(site)
        return row => grid[row]![site]!
      },
      sites: [0, 1, 2],
      maxValue: 3,
    })
    expect(seen).toContain(2)
  })

  test('skips a site with no data without touching a row', () => {
    const read = jest.fn((site: number) =>
      site === 1 ? undefined : (row: number) => grid[row]![site]!,
    )
    expect(
      refineRowsBySite({
        items,
        readSite: read,
        sites: [0, 1, 2],
        maxValue: 3,
      }),
    ).toEqual(['a', 'c', 'd', 'b'])
    expect(read).toHaveBeenCalledWith(1)
  })

  test('handles a single row and no rows', () => {
    expect(
      refineRowsBySite({ items: ['only'], readSite, sites: [0], maxValue: 3 }),
    ).toEqual(['only'])
    expect(
      refineRowsBySite({ items: [], readSite, sites: [0], maxValue: 3 }),
    ).toEqual([])
  })
})

function makeSources(names: string[], phased: boolean): ProcessedSource[] {
  return phased
    ? names.flatMap(name =>
        [0, 1].map(hp => ({
          name: `${name} HP${hp}`,
          sampleName: name,
          HP: hp,
        })),
      )
    : names.map(name => ({ name, sampleName: name }))
}

// Build the interned payload the display ships, from a plain
// featureId -> sampleName -> genotype table.
function makePayload(table: Record<string, Record<string, string>>) {
  const featureIds = Object.keys(table)
  const sampleNames = [
    ...new Set(featureIds.flatMap(f => Object.keys(table[f]!))),
  ]
  const genotypeDict: string[] = []
  const genotypeCodesByFeatureId = new Map<string, Uint16Array>()
  for (const featureId of featureIds) {
    const codes = new Uint16Array(sampleNames.length)
    for (let i = 0; i < sampleNames.length; i++) {
      const genotype = table[featureId]![sampleNames[i]!]
      if (genotype !== undefined) {
        let idx = genotypeDict.indexOf(genotype)
        if (idx === -1) {
          idx = genotypeDict.length
          genotypeDict.push(genotype)
        }
        codes[i] = idx + 1
      }
    }
    genotypeCodesByFeatureId.set(featureId, codes)
  }
  return { featureIds, sampleNames, genotypeDict, genotypeCodesByFeatureId }
}

function names(sources: ProcessedSource[] | undefined) {
  return sources?.map(s => s.name)
}

describe('sortSourcesAroundVariant', () => {
  test('ranks by dosage at the anchor, hom-alt first and no-call last', () => {
    const payload = makePayload({
      v1: { homRef: '0/0', het: '0/1', homAlt: '1/1', noCall: './.' },
    })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources: makeSources(['homRef', 'het', 'homAlt', 'noCall'], false),
      anchorFeatureId: 'v1',
      phased: false,
    })
    expect(names(sorted)).toEqual(['homAlt', 'het', 'homRef', 'noCall'])
  })

  test('breaks anchor ties by the flanking genotypes', () => {
    // a and b tie at the anchor; a matches c on the left, b does not
    const payload = makePayload({
      left: { a: '1/1', b: '0/0', c: '1/1' },
      anchor: { a: '0/1', b: '0/1', c: '0/1' },
      right: { a: '0/0', b: '0/0', c: '0/0' },
    })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources: makeSources(['a', 'b', 'c'], false),
      anchorFeatureId: 'anchor',
      phased: false,
    })
    expect(names(sorted)).toEqual(['a', 'c', 'b'])
  })

  test('splits haplotypes of one sample in phased mode', () => {
    const payload = makePayload({ v1: { s1: '0|1', s2: '1|0' } })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources: makeSources(['s1', 's2'], true),
      anchorFeatureId: 'v1',
      phased: true,
    })
    // the alt-carrying haplotypes lead, regardless of which sample they are on
    expect(names(sorted)).toEqual(['s1 HP1', 's2 HP0', 's1 HP0', 's2 HP1'])
  })

  test('groups haplotypes carrying the same alt at a multiallelic site', () => {
    // allele identity is compared exactly here, unlike the clustering matrix,
    // where every alt collapses to one indicator
    const payload = makePayload({
      v1: { s1: '1|0', s2: '2|0', s3: '1|0' },
    })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources: makeSources(['s1', 's2', 's3'], true),
      anchorFeatureId: 'v1',
      phased: true,
    })
    const hp0 = names(sorted)!.filter(n => n.endsWith('HP0'))
    expect(hp0).toEqual(['s1 HP0', 's3 HP0', 's2 HP0'])
  })

  test('sorts an unphased call last in phased mode', () => {
    // '0/1' says a sample carries an alt but not which haplotype has it
    const payload = makePayload({ v1: { s1: '0|1', s2: '0/1' } })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources: makeSources(['s1', 's2'], true),
      anchorFeatureId: 'v1',
      phased: true,
    })
    expect(names(sorted)!.slice(-2)).toEqual(['s2 HP0', 's2 HP1'])
  })

  test('returns undefined when the anchor is not loaded', () => {
    const payload = makePayload({ v1: { a: '0/1' } })
    expect(
      sortSourcesAroundVariant({
        ...payload,
        sources: makeSources(['a'], false),
        anchorFeatureId: 'nope',
        phased: false,
      }),
    ).toBeUndefined()
  })

  test('sorts a sample absent from the payload last', () => {
    const payload = makePayload({ v1: { a: '0/0' } })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources: makeSources(['a', 'ghost'], false),
      anchorFeatureId: 'v1',
      phased: false,
    })
    expect(names(sorted)).toEqual(['a', 'ghost'])
  })

  test('keeps every input row exactly once', () => {
    const payload = makePayload({
      v1: { a: '0/1', b: '1/1', c: './.', d: '0/0' },
      v2: { a: '0/0', b: '0/1', c: '1/1', d: '0/1' },
    })
    const sources = makeSources(['a', 'b', 'c', 'd'], false)
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources,
      anchorFeatureId: 'v2',
      phased: false,
    })
    expect(names(sorted)!.toSorted()).toEqual(names(sources)!.toSorted())
  })
})

// The third consumer of a haploid genotype, after the render loops and the
// clustering matrix. All three have to agree that a bare "1" is a real allele on
// HP0 and says nothing about HP1 — the render loops didn't, and nothing here
// pinned it. 1000G chrX non-PAR is the canonical shape: haploid males beside
// phased diploid females.
describe('sortSourcesAroundVariant mixed ploidy', () => {
  // Females expand to two haplotype rows, males to one — but maxPloidy is per
  // file, so a male still gets an HP1 row with nothing to draw on it.
  const sources: ProcessedSource[] = [
    { name: 'FEMALE HP0', sampleName: 'FEMALE', HP: 0 },
    { name: 'FEMALE HP1', sampleName: 'FEMALE', HP: 1 },
    { name: 'MALE_ALT HP0', sampleName: 'MALE_ALT', HP: 0 },
    { name: 'MALE_ALT HP1', sampleName: 'MALE_ALT', HP: 1 },
    { name: 'MALE_REF HP0', sampleName: 'MALE_REF', HP: 0 },
    { name: 'MALE_REF HP1', sampleName: 'MALE_REF', HP: 1 },
  ]

  test('a haploid alt outranks a haploid ref, and its absent haplotype sorts last', () => {
    const payload = makePayload({
      v1: { FEMALE: '1|0', MALE_ALT: '1', MALE_REF: '0' },
    })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources,
      anchorFeatureId: 'v1',
      phased: true,
    })
    const order = names(sorted)!
    // alt-carrying haplotypes lead: FEMALE HP0 (1) and MALE_ALT HP0 (1)
    expect(order.slice(0, 2).sort()).toEqual(['FEMALE HP0', 'MALE_ALT HP0'])
    // the reference haplotypes come next
    expect(order.slice(2, 4).sort()).toEqual(['FEMALE HP1', 'MALE_REF HP0'])
    // haplotypes the samples don't have rank last, with the no-calls
    expect(order.slice(4).sort()).toEqual(['MALE_ALT HP1', 'MALE_REF HP1'])
  })

  test('a haploid call is not read as unphased', () => {
    // An unphased call assigns no allele to either row, so it must rank below a
    // haploid alt rather than beside it.
    const payload = makePayload({
      v1: { FEMALE: '0/1', MALE_ALT: '1', MALE_REF: '0' },
    })
    const sorted = sortSourcesAroundVariant({
      ...payload,
      sources,
      anchorFeatureId: 'v1',
      phased: true,
    })
    const order = names(sorted)!
    expect(order[0]).toBe('MALE_ALT HP0')
    expect(order.indexOf('MALE_REF HP0')).toBeLessThan(
      order.indexOf('FEMALE HP0'),
    )
  })
})
