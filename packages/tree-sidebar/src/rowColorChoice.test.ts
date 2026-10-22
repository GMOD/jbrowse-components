import {
  liftRowColor,
  rowColorChoiceOf,
  rowColorMembers,
  rowColorResetTarget,
  startingRowColor,
  withPair,
} from './rowColorChoice.ts'

const lift = liftRowColor

describe('liftRowColor', () => {
  it('reads a string as the field, and an empty or missing field as name', () => {
    expect(lift('group').field).toBe('group')
    expect(lift({ field: '' }).field).toBe('name')
    expect(lift(undefined)).toEqual({
      field: 'name',
      scale: { domain: [], range: [] },
    })
  })

  it('reads a numeric domain as strings, and a null unknown as unset', () => {
    expect(lift({ scale: { domain: [1, 2], unknown: null } })).toEqual({
      field: 'name',
      scale: { domain: ['1', '2'], range: [] },
    })
  })

  it('writes back only the set members', () => {
    expect(
      rowColorMembers(lift({ field: 'group', scale: { unknown: '' } })),
    ).toEqual({ field: 'group', scale: { unknown: '' } })
  })
})

describe('rowColorChoiceOf', () => {
  it('is None for a name setting that colors no row', () => {
    expect(rowColorChoiceOf(lift({}), false)).toBe('')
    expect(rowColorChoiceOf(lift({ scale: { unknown: '' } }), false)).toBe('')
    expect(rowColorChoiceOf(lift({ scale: { unknown: '' } }), true)).toBe('')
  })

  it('is Each row where a pick, an Other color or the palette colors a row', () => {
    expect(rowColorChoiceOf(lift({}), true)).toBe('name')
    expect(rowColorChoiceOf(lift({ scale: { unknown: '#ccc' } }), false)).toBe(
      'name',
    )
    expect(
      rowColorChoiceOf(
        lift({ scale: { domain: ['a'], range: ['#f00'] } }),
        false,
      ),
    ).toBe('name')
    expect(
      rowColorChoiceOf(
        lift({ scale: { domain: ['a'], range: ['#f00'], unknown: '' } }),
        true,
      ),
    ).toBe('name')
  })

  it('is the attribute', () => {
    expect(rowColorChoiceOf(lift('group'), false)).toBe('group')
    expect(
      rowColorChoiceOf(lift({ field: 'group', scale: { unknown: '' } }), true),
    ).toBe('group')
  })
})

describe('withPair', () => {
  it('replaces a pair in place and appends a new one', () => {
    const two = lift({ scale: { domain: ['a', 'b'], range: ['#f00', '#0f0'] } })
    expect(withPair(two, 'a', '#00f').scale).toMatchObject({
      domain: ['a', 'b'],
      range: ['#00f', '#0f0'],
    })
    expect(withPair(two, 'c', '#00f').scale).toMatchObject({
      domain: ['a', 'b', 'c'],
      range: ['#f00', '#0f0', '#00f'],
    })
  })

  it('keeps the spare range entries the unpaired values take', () => {
    const spares = lift({
      field: 'population',
      scale: { range: ['red', 'blue', 'green'] },
    })
    expect(withPair(spares, 'EAS', 'black').scale).toMatchObject({
      domain: ['EAS'],
      range: ['black', 'red', 'blue', 'green'],
    })
  })
})

describe('startingRowColor', () => {
  const grey = lift({
    field: 'group',
    scale: { domain: ['y'], range: ['#abc'], unknown: '#ccc' },
  })
  const tissue = lift({
    field: 'tissue',
    scale: { domain: ['t'], range: ['#f00'] },
  })

  it('None colors no row', () => {
    expect(rowColorMembers(startingRowColor('', [grey], false))).toEqual({
      field: 'name',
    })
    expect(rowColorMembers(startingRowColor('', [grey], true))).toEqual({
      field: 'name',
      scale: { unknown: '' },
    })
  })

  it('takes the first setting showing the choice, the current then the config', () => {
    expect(startingRowColor('group', [grey, tissue], false)).toBe(grey)
    expect(startingRowColor('tissue', [grey, tissue], false)).toBe(tissue)
  })

  it('starts any other choice with no color of its own', () => {
    expect(rowColorMembers(startingRowColor('pop', [grey], false))).toEqual({
      field: 'pop',
    })
  })

  // An overlay's None is a name setting too, so Each row starts from nothing
  // rather than from the None.
  it("does not start Each row from a None's unknown: ''", () => {
    expect(
      rowColorMembers(
        startingRowColor('name', [lift({ scale: { unknown: '' } })], true),
      ),
    ).toEqual({ field: 'name' })
  })
})

// Whatever the reset writes is itself no custom arrangement, so one reset is
// the whole way back.
describe('rowColorResetTarget', () => {
  function settled(live: unknown, base: unknown, paletteDeals = false) {
    const target = rowColorResetTarget(lift(live), lift(base), paletteDeals)
    if (target) {
      expect(
        rowColorResetTarget(target, lift(base), paletteDeals),
      ).toBeUndefined()
    }
    return target && rowColorMembers(target)
  }

  it('never changes the choice', () => {
    expect(settled('group', {})).toBeUndefined()
    expect(settled({}, 'group')).toBeUndefined()
    expect(settled('tissue', 'group')).toBeUndefined()
    expect(
      settled('group', { scale: { domain: ['a'], range: ['#f00'] } }),
    ).toBeUndefined()
    expect(settled({ scale: { unknown: '' } }, {}, true)).toBeUndefined()
  })

  it("returns the choice's pairs and unknown to the base's", () => {
    const base = { field: 'name', scale: { domain: ['a'], range: ['#f00'] } }
    expect(
      settled({ scale: { domain: ['b'], range: ['#00f'] } }, base),
    ).toEqual(base)
    expect(
      settled({ ...base, scale: { ...base.scale, unknown: '#ccc' } }, base),
    ).toEqual(base)
    const grouped = {
      field: 'group',
      scale: { domain: ['x'], range: ['#0f0'] },
    }
    expect(
      settled(
        { field: 'group', scale: { domain: ['y'], range: ['#abcdef'] } },
        grouped,
      ),
    ).toEqual(grouped)
  })

  it('clears the colors of a choice the base does not make', () => {
    const base = { field: 'group', scale: { unknown: '#ccc' } }
    expect(
      settled(
        { field: 'tissue', scale: { domain: ['t'], range: ['#abc'] } },
        base,
      ),
    ).toEqual({ field: 'tissue' })
    expect(
      settled({ scale: { domain: ['a'], range: ['#f00'] } }, {}, true),
    ).toEqual({
      field: 'name',
    })
  })

  // A config's grey for the values it lists none for is no reason to call
  // another attribute picked over it custom.
  it("is not custom where the base's unknown sits on another field", () => {
    expect(
      settled('superpop', { field: 'population', scale: { unknown: '#ccc' } }),
    ).toBe(undefined)
  })

  it('returns cleared spare range entries', () => {
    const base = {
      field: 'population',
      scale: { range: ['red', 'blue', 'green'] },
    }
    expect(settled({ field: 'population' }, base)).toEqual(base)
    expect(settled(base, base)).toBeUndefined()
  })

  it('reads pairs listed in another order as the same', () => {
    const base = { scale: { domain: ['a', 'b'], range: ['#f00', '#00f'] } }
    expect(
      settled({ scale: { domain: ['b', 'a'], range: ['#00f', '#f00'] } }, base),
    ).toBeUndefined()
  })
})
