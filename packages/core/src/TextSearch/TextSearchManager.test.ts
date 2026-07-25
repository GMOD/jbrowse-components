import BaseResult from './BaseResults.ts'
import TextSearchManager from './TextSearchManager.ts'

const manager = new TextSearchManager({} as never)

const sort = async (labels: string[], queryString: string) =>
  (
    await manager.sortResults({
      results: labels.map(label => new BaseResult({ label })),
      args: { queryString },
    })
  ).map(r => r.getLabel())

describe('sortResults', () => {
  it('floats display-string matches to the top', async () => {
    expect(await sort(['other', 'BRCA1', 'BRCA1 pseudogene'], 'BRCA1')).toEqual(
      ['BRCA1', 'BRCA1 pseudogene', 'other'],
    )
  })

  it('keeps hits whose match lives outside the display string', async () => {
    // regression: TrixTextSearchAdapter accepts "eden splice" by scanning every
    // indexed attribute, but the display string is just "EDEN.1" — the fuzzy
    // pass used to filter those away, so multi-word search returned nothing
    expect(await sort(['EDEN.1', 'EDEN.2'], 'eden splice')).toEqual([
      'EDEN.1',
      'EDEN.2',
    ])
  })

  it('keeps results for a query with no alphanumeric characters', async () => {
    expect(await sort(['a', 'b'], '...')).toEqual(['a', 'b'])
  })

  it('returns nothing for no results', async () => {
    expect(await sort([], 'anything')).toEqual([])
  })
})
