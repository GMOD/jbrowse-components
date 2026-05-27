import {
  extraColumns,
  moveDown,
  moveUp,
  updateRows,
} from './sourcesGridUtils.ts'

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
})

describe('updateRows', () => {
  it('returns a new array with selected rows patched, others untouched', () => {
    const a = { name: 'a', color: 'red' }
    const b = { name: 'b', color: 'green' }
    const c = { name: 'c', color: 'blue' }
    const result = updateRows([a, b, c], ['a', 'c'], { color: 'pink' })
    expect(result[0]!.color).toBe('pink')
    expect(result[1]).toBe(b)
    expect(result[2]!.color).toBe('pink')
  })

  it('returns a new outer array reference even when nothing matches', () => {
    const rows = [{ name: 'a', color: 'red' }]
    const result = updateRows(rows, ['missing'], { color: 'pink' })
    expect(result).not.toBe(rows)
    expect(result[0]).toBe(rows[0])
  })
})

describe('extraColumns', () => {
  const reserved = new Set(['name', 'color'])

  it('returns empty when every key is reserved', () => {
    expect(extraColumns([{ name: 'a', color: 'red' }], reserved)).toEqual([])
  })

  it('returns extra fields beyond the reserved set', () => {
    expect(
      extraColumns(
        [{ name: 'a', color: 'red', label: 'A', group: 'g1' }],
        reserved,
      ).sort(),
    ).toEqual(['group', 'label'])
  })

  it('unions field names across rows (heterogeneous adapters)', () => {
    const rows = [
      { name: 'a', label: 'A' },
      { name: 'b', group: 'g1' },
      { name: 'c', population: 'EUR' },
    ]
    expect(extraColumns(rows, reserved).sort()).toEqual([
      'group',
      'label',
      'population',
    ])
  })

  it('returns empty for empty input', () => {
    expect(extraColumns([], reserved)).toEqual([])
  })
})
