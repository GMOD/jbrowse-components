import { reorder, reorderWithin } from './reorder.ts'

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

describe('reorderWithin', () => {
  // A B a b, uppercase in one panel and lowercase in another, interleaved the
  // way session.views is once two panels are open.
  const arr = ['A', 'b', 'B', 'a']
  const upper = (s: string) => s === s.toUpperCase()

  it('moves past the previous in-scope element, not the previous element', () => {
    // 'B' is at index 2 with 'b' before it; up means past 'A', and 'b' does not
    // move out of the way to make room
    expect(reorderWithin(arr, 2, 'up', upper)).toEqual(['B', 'b', 'A', 'a'])
  })

  it('leaves out-of-scope elements in their own slots', () => {
    const out = reorderWithin(arr, 0, 'bottom', upper)
    expect(out).toEqual(['B', 'b', 'A', 'a'])
    expect(out[1]).toBe('b')
    expect(out[3]).toBe('a')
  })

  it('is a no-op at the edge of the scope, not of the array', () => {
    // 'A' is the first uppercase, so up does nothing even though index 0 is not
    // where the scope's other member sits
    expect(reorderWithin(arr, 0, 'up', upper)).toEqual(arr)
    // and 'B' is the last uppercase, so down does nothing despite 'a' following
    expect(reorderWithin(arr, 2, 'down', upper)).toEqual(arr)
  })

  it('degenerates to reorder when everything is in scope', () => {
    for (const direction of ['up', 'down', 'top', 'bottom'] as const) {
      for (let i = 0; i < arr.length; i++) {
        expect(reorderWithin(arr, i, direction, () => true)).toEqual(
          reorder(arr, i, direction),
        )
      }
    }
  })

  it('returns an unchanged copy when the index is out of scope', () => {
    const out = reorderWithin(arr, 1, 'top', upper)
    expect(out).toEqual(arr)
    expect(out).not.toBe(arr)
  })

  it('does not mutate the input', () => {
    reorderWithin(arr, 0, 'bottom', upper)
    expect(arr).toEqual(['A', 'b', 'B', 'a'])
  })
})
