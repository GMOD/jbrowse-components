import BaseResult from './BaseResults.ts'
import TextSearchManager from './TextSearchManager.ts'

import type { BaseTextSearchAdapter } from '../data_adapters/BaseAdapter/index.ts'

const manager = new TextSearchManager({} as never)

// minimal stand-in exposing only the surface search() calls
function fakeAdapter(searchIndex: () => Promise<BaseResult[]>) {
  return { searchIndex } as unknown as BaseTextSearchAdapter
}

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

describe('search resilience', () => {
  it('keeps healthy adapters results when another one fails', async () => {
    // a 404 .ix used to reject the whole Promise.all, which also threw away the
    // refName results fetchResults merges in afterwards, so a single broken
    // index made even "type chr1 and hit enter" fail
    const m = new TextSearchManager({} as never)
    m.loadTextSearchAdapters = async () => [
      fakeAdapter(() => Promise.reject(new Error('404 out.ix'))),
      fakeAdapter(async () => [new BaseResult({ label: 'BRCA1' })]),
    ]
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const results = await m.search({ queryString: 'BRCA1' }, 'hg38')

    expect(results.map(r => r.getLabel())).toEqual(['BRCA1'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

// A track's text index names whatever assembly the track it was built from
// named, while a search arrives under the name the session knows — so the two
// only meet through the aliases. Comparing them raw left an index unreachable
// from the very assembly it indexes.
describe('relevantAdapters', () => {
  // hg19 is an alias of the session's GRCh37
  const aliasing = {
    getCanonicalAssemblyName: (name: string) =>
      name === 'hg19' ? 'GRCh37' : name,
  }

  function managerWith(assemblyNames: string[], assemblyManager?: unknown) {
    return new TextSearchManager({
      rootModel: {
        jbrowse: {
          aggregateTextSearchAdapters: [
            {
              assemblyNames,
              textSearchAdapterId: 'agg',
            },
          ],
        },
        session: { tracks: [], assemblyManager },
      },
    } as never)
  }

  it('finds an index that names an alias of the searched assembly', () => {
    expect(
      managerWith(['hg19'], aliasing).relevantAdapters('GRCh37'),
    ).toHaveLength(1)
    expect(
      managerWith(['GRCh37'], aliasing).relevantAdapters('hg19'),
    ).toHaveLength(1)
  })

  it('still rejects an index for a different assembly', () => {
    expect(managerWith(['mm10'], aliasing).relevantAdapters('GRCh37')).toEqual(
      [],
    )
  })

  it('falls back to the raw name with no session to resolve against', () => {
    expect(managerWith(['hg19']).relevantAdapters('hg19')).toHaveLength(1)
    expect(managerWith(['hg19']).relevantAdapters('GRCh37')).toEqual([])
  })
})
