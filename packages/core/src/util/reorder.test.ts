import { reorder } from './index.ts'

describe('reorder', () => {
  const arr = ['a', 'b', 'c', 'd']

  it('moves an element up', () => {
    expect(reorder(arr, 2, 'up')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves an element down', () => {
    expect(reorder(arr, 1, 'down')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves an element to the top', () => {
    expect(reorder(arr, 2, 'top')).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves an element to the bottom', () => {
    expect(reorder(arr, 1, 'bottom')).toEqual(['a', 'c', 'd', 'b'])
  })

  it('is a no-op moving the first element up', () => {
    expect(reorder(arr, 0, 'up')).toEqual(arr)
  })

  it('is a no-op moving the last element down', () => {
    expect(reorder(arr, 3, 'down')).toEqual(arr)
  })

  it('returns an unchanged copy for an out-of-range index', () => {
    const out = reorder(arr, -1, 'up')
    expect(out).toEqual(arr)
    expect(out).not.toBe(arr)
  })

  it('does not mutate the input', () => {
    reorder(arr, 0, 'bottom')
    expect(arr).toEqual(['a', 'b', 'c', 'd'])
  })
})
