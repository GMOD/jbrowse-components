import { lookupGeneticCodeId } from './geneticCodes.ts'

// chrM is canonical, the RefSeq accession is an alias of it
const aliases = {
  chrM: 'chrM',
  'NC_012920.1': 'chrM',
  chr1: 'chr1',
}

test('falls back to the standard code for an unlisted refName', () => {
  expect(lookupGeneticCodeId('chr1', aliases, [{ chrM: 2 }])).toBe(1)
})

test('falls back to the standard code when no maps have entries', () => {
  expect(lookupGeneticCodeId('chrM', aliases, [{}, {}])).toBe(1)
})

test('resolves a direct key hit', () => {
  expect(lookupGeneticCodeId('chrM', aliases, [{ chrM: 2 }])).toBe(2)
})

// config keyed by the RefSeq accession, queried by the canonical UCSC name
test('resolves a map keyed by an alias of the queried canonical refName', () => {
  expect(lookupGeneticCodeId('chrM', aliases, [{ 'NC_012920.1': 2 }])).toBe(2)
})

// the inverse: config keyed canonically, queried with a feature's own alias
// refName (as BaseFeatureWidget does with feature.refName)
test('resolves a canonically-keyed map queried with an alias refName', () => {
  expect(lookupGeneticCodeId('NC_012920.1', aliases, [{ chrM: 2 }])).toBe(2)
})

test('resolves when both the key and the query are aliases', () => {
  expect(
    lookupGeneticCodeId('NC_012920.1', { ...aliases, MT: 'chrM' }, [{ MT: 2 }]),
  ).toBe(2)
})

test('earlier maps win over later ones', () => {
  expect(
    lookupGeneticCodeId('chrM', aliases, [{ chrM: 2 }, { chrM: 11 }]),
  ).toBe(2)
})

// a later map still supplies refNames the earlier one omits
test('falls through to a later map for a refName the first omits', () => {
  expect(
    lookupGeneticCodeId('chrM', aliases, [{ chrPltd: 11 }, { chrM: 2 }]),
  ).toBe(2)
})

// with no aliases loaded, only direct key hits can resolve
test('resolves direct hits when aliases are not loaded', () => {
  expect(lookupGeneticCodeId('chrM', undefined, [{ chrM: 2 }])).toBe(2)
  expect(lookupGeneticCodeId('NC_012920.1', undefined, [{ chrM: 2 }])).toBe(1)
})
