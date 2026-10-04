import {
  liftRowColor,
  keptUnknown,
  rowColorChoiceOf,
  rowColorChoiceSetting,
  rowColorForChoice,
  rowColorMembers,
  rowColorResetTarget,
} from './rowColorChoice.ts'

const lift = liftRowColor

describe('liftRowColor', () => {
  it('reads a string as the field, and an empty or missing field as name', () => {
    expect(lift('group').field).toBe('group')
    expect(lift({ field: '' }).field).toBe('name')
    expect(lift(undefined)).toEqual({
      field: 'name',
      scale: undefined,
      domain: [],
      range: [],
    })
  })

  it('reads a numeric domain as strings, and a null unknown as unset', () => {
    expect(lift({ domain: [1, 2], unknown: null })).toEqual({
      field: 'name',
      scale: undefined,
      domain: ['1', '2'],
      range: [],
    })
  })

  it('writes back only the set members', () => {
    expect(rowColorMembers(lift({ field: 'group', unknown: '' }))).toEqual({
      field: 'group',
      unknown: '',
    })
  })
})

describe('rowColorChoiceOf', () => {
  it('is Each row only where the palette deals and nothing holds it off', () => {
    expect(rowColorChoiceOf(lift({}), true)).toBe('name')
    expect(rowColorChoiceOf(lift({ unknown: '' }), true)).toBe('')
    expect(rowColorChoiceOf(lift({ unknown: '#ccc' }), true)).toBe('name')
  })

  it('is None on stacked rows whatever unknown says, since no palette deals', () => {
    expect(rowColorChoiceOf(lift({}), false)).toBe('')
    expect(rowColorChoiceOf(lift({ unknown: '#ccc' }), false)).toBe('')
  })

  it("is the attribute, or None under scale: 'none'", () => {
    expect(rowColorChoiceOf(lift('group'), false)).toBe('group')
    expect(
      rowColorChoiceOf(lift({ field: 'group', scale: 'none' }), true),
    ).toBe('')
  })
})

describe('keptUnknown', () => {
  const grey = lift({ domain: ['a'], range: ['#f00'], unknown: '#ccc' })

  it("is the config's unknown on the same field, under None or Each row", () => {
    expect(keptUnknown(grey, '')).toBe('#ccc')
    expect(keptUnknown(grey, 'name')).toBe('#ccc')
    expect(keptUnknown(lift({ field: 'group', unknown: '' }), 'group')).toBe('')
  })

  it("is unset on another field, and drops Each row's '', which is None", () => {
    expect(keptUnknown(grey, 'group')).toBeUndefined()
    expect(keptUnknown(lift({ unknown: '' }), 'name')).toBeUndefined()
    expect(keptUnknown(lift({ unknown: '' }), '')).toBe('')
  })
})

describe('rowColorChoiceSetting', () => {
  it("None where the palette deals is unknown: '', whatever the swatch", () => {
    expect(rowColorChoiceSetting(true, '', {}, '#ccc')).toEqual({
      field: 'name',
      unknown: '',
    })
    expect(rowColorChoiceSetting(true, '', {}, undefined)).toEqual({
      field: 'name',
      unknown: '',
    })
  })

  it('None on stacked rows and Each row write the swatch, or nothing', () => {
    expect(rowColorChoiceSetting(false, '', {}, '#ccc')).toEqual({
      field: 'name',
      unknown: '#ccc',
    })
    expect(rowColorChoiceSetting(false, '', {}, undefined)).toEqual({
      field: 'name',
    })
    expect(rowColorChoiceSetting(true, 'name', {}, '#ccc')).toEqual({
      field: 'name',
      unknown: '#ccc',
    })
  })

  it('an attribute takes its pairs and the swatch', () => {
    expect(rowColorChoiceSetting(false, 'group', { y: '#abcdef' }, '')).toEqual(
      {
        field: 'group',
        domain: ['y'],
        range: ['#abcdef'],
        unknown: '',
      },
    )
    expect(rowColorChoiceSetting(false, 'group', {}, undefined)).toEqual({
      field: 'group',
    })
  })
})

describe('rowColorForChoice', () => {
  const pairs = { field: 'group', domain: ['y'], range: ['#abc'] }

  it('None leaves an attribute and its pairs behind', () => {
    expect(rowColorForChoice(lift(pairs), '', false)).toEqual({ field: 'name' })
    expect(rowColorForChoice(lift(pairs), '', true)).toEqual({
      field: 'name',
      unknown: '',
    })
  })

  it('the field already named keeps its pairs and unknown, parked or not', () => {
    const parked = { ...pairs, scale: 'none', unknown: '#ccc' }
    expect(rowColorForChoice(lift(parked), 'group', false)).toEqual({
      field: 'group',
      domain: ['y'],
      range: ['#abc'],
      unknown: '#ccc',
    })
  })

  it('another field starts with none', () => {
    expect(rowColorForChoice(lift(pairs), 'pop', false)).toEqual({
      field: 'pop',
    })
  })

  it('None over name pairs keeps them', () => {
    const named = { domain: ['a'], range: ['#f00'] }
    expect(rowColorForChoice(lift(named), '', true)).toEqual({
      field: 'name',
      ...named,
      unknown: '',
    })
  })
})

// Whatever the reset writes is itself no custom arrangement, so one reset is
// the whole way back.
describe('rowColorResetTarget', () => {
  function settled(live: unknown, base: unknown) {
    const target = rowColorResetTarget(lift(live), lift(base))
    if (target) {
      expect(rowColorResetTarget(target, lift(base))).toBeUndefined()
    }
    return target && rowColorMembers(target)
  }

  it('writes nothing over a colour by picked over a config setting none', () => {
    expect(settled('group', {})).toBeUndefined()
    expect(settled({}, {})).toBeUndefined()
  })

  it('returns a name pair, an unknown, or a parked field to the base', () => {
    const base = { field: 'name', domain: ['a'], range: ['#f00'] }
    expect(settled({ domain: ['b'], range: ['#00f'] }, base)).toEqual(base)
    expect(settled({ ...base, unknown: '' }, base)).toEqual(base)
    expect(settled('group', base)).toEqual(base)
    expect(settled({ ...base, scale: 'none' }, base)).toEqual(base)
  })

  it('returns a parked field, or one parked by the base, to the base', () => {
    expect(settled({ field: 'group', scale: 'none' }, 'group')).toEqual({
      field: 'group',
    })
    expect(settled({ scale: 'none' }, {})).toEqual({ field: 'name' })
    expect(settled('group', { field: 'group', scale: 'none' })).toEqual({
      field: 'group',
      scale: 'none',
    })
  })

  it("returns None over the base's colour by to it", () => {
    expect(settled({}, 'group')).toEqual({ field: 'group' })
    expect(settled({ unknown: '' }, 'group')).toEqual({ field: 'group' })
  })

  it("returns a value recolour to the base's colours and keeps the attribute", () => {
    expect(
      settled({ field: 'group', domain: ['y'], range: ['#abcdef'] }, {}),
    ).toEqual({ field: 'group' })
    const base = { field: 'group', domain: ['x'], range: ['#0f0'] }
    expect(
      settled({ field: 'group', domain: ['y'], range: ['#abcdef'] }, base),
    ).toEqual(base)
  })

  it("keeps the base's unknown with the attribute, in one reset", () => {
    const base = { field: 'group', unknown: '#ccc' }
    expect(
      settled(
        { field: 'group', domain: ['y'], range: ['#abcdef'], unknown: '#ccc' },
        base,
      ),
    ).toEqual(base)
    expect(
      settled(
        { field: 'tissue', domain: ['t'], range: ['#abcdef'], unknown: '#ccc' },
        base,
      ),
    ).toEqual({ field: 'tissue', unknown: '#ccc' })
  })
})
