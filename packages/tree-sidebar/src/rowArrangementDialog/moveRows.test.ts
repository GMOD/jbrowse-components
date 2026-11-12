import { moveDown, moveUp } from './moveRows.ts'

interface Item {
  name: string
}

describe('moveUp', () => {
  it('moves a single item up by 1', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(moveUp(arr, ['b']).map(x => x.name)).toEqual(['b', 'a', 'c'])
  })

  it('does not move past the start', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(moveUp(arr, ['a']).map(x => x.name)).toEqual(['a', 'b', 'c'])
  })

  it('moves by custom step', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    expect(moveUp(arr, ['c'], 2).map(x => x.name)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('clamps to start when step would overshoot', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(moveUp(arr, ['b'], 5).map(x => x.name)).toEqual(['b', 'a', 'c'])
  })

  it('moves multiple selected items up preserving relative order', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    expect(moveUp(arr, ['b', 'c']).map(x => x.name)).toEqual([
      'b',
      'c',
      'a',
      'd',
    ])
  })

  it('does not mutate the input array', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveUp(arr, ['b'])
    expect(arr.map(x => x.name)).toEqual(['a', 'b', 'c'])
  })
})

describe('moveDown', () => {
  it('moves a single item down by 1', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(moveDown(arr, ['b']).map(x => x.name)).toEqual(['a', 'c', 'b'])
  })

  it('does not move past the end', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(moveDown(arr, ['c']).map(x => x.name)).toEqual(['a', 'b', 'c'])
  })

  it('moves by custom step', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    expect(moveDown(arr, ['b'], 2).map(x => x.name)).toEqual([
      'a',
      'c',
      'd',
      'b',
    ])
  })

  it('clamps to end when step would overshoot', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    expect(moveDown(arr, ['b'], 5).map(x => x.name)).toEqual(['a', 'c', 'b'])
  })

  it('moves multiple selected items down preserving relative order', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    expect(moveDown(arr, ['b', 'c']).map(x => x.name)).toEqual([
      'a',
      'd',
      'b',
      'c',
    ])
  })

  it('does not mutate the input array', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveDown(arr, ['b'])
    expect(arr.map(x => x.name)).toEqual(['a', 'b', 'c'])
  })
})
