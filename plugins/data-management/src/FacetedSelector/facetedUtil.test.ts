import { getRootKeys } from './facetedUtil.ts'

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
