import { moveDown, moveUp } from './util.ts'

interface Item {
  name: string
}

describe('moveUp', () => {
  it('moves a single item up by 1', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveUp(arr, ['b'])
    expect(arr.map(x => x.name)).toEqual(['b', 'a', 'c'])
  })

  it('does not move past the start', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveUp(arr, ['a'])
    expect(arr.map(x => x.name)).toEqual(['a', 'b', 'c'])
  })

  it('moves by custom step', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    moveUp(arr, ['c'], 2)
    expect(arr.map(x => x.name)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('clamps to start when step would overshoot', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveUp(arr, ['b'], 5)
    expect(arr.map(x => x.name)).toEqual(['b', 'a', 'c'])
  })

  it('moves multiple selected items up preserving relative order', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    moveUp(arr, ['b', 'c'])
    expect(arr.map(x => x.name)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('returns the mutated array', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }]
    const result = moveUp(arr, ['b'])
    expect(result).toBe(arr)
  })
})

describe('moveDown', () => {
  it('moves a single item down by 1', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveDown(arr, ['b'])
    expect(arr.map(x => x.name)).toEqual(['a', 'c', 'b'])
  })

  it('does not move past the end', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveDown(arr, ['c'])
    expect(arr.map(x => x.name)).toEqual(['a', 'b', 'c'])
  })

  it('moves by custom step', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    moveDown(arr, ['b'], 2)
    expect(arr.map(x => x.name)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('clamps to end when step would overshoot', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    moveDown(arr, ['b'], 5)
    expect(arr.map(x => x.name)).toEqual(['a', 'c', 'b'])
  })

  it('moves multiple selected items down preserving relative order', () => {
    const arr: Item[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'd' },
    ]
    moveDown(arr, ['b', 'c'])
    expect(arr.map(x => x.name)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('returns the mutated array', () => {
    const arr: Item[] = [{ name: 'a' }, { name: 'b' }]
    const result = moveDown(arr, ['a'])
    expect(result).toBe(arr)
  })
})
