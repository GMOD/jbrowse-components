import { findNonSparseKeys, getRootKeys } from './facetedUtil.ts'

describe('findNonSparseKeys', () => {
  test('keeps keys populated in more than the threshold rows', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      dense: 'x',
      sparse: i < 3 ? 'y' : '',
    }))
    expect(
      findNonSparseKeys(['dense', 'sparse'], rows, (r, f) =>
        f === 'dense' ? r.dense : r.sparse,
      ),
    ).toEqual(['dense'])
  })

  test('threshold is configurable', () => {
    const rows = Array.from({ length: 4 }, () => ({ a: 'x' }))
    expect(findNonSparseKeys(['a'], rows, r => r.a, 2)).toEqual(['a'])
    expect(findNonSparseKeys(['a'], rows, r => r.a, 4)).toEqual([])
  })
})

describe('getRootKeys', () => {
  test('keeps scalar keys, drops null/undefined/object values', () => {
    expect(
      getRootKeys({
        str: 'x',
        num: 1,
        bool: false,
        nil: null,
        undef: undefined,
        obj: { nested: 1 },
      }).sort(),
    ).toEqual(['bool', 'num', 'str'])
  })
})
