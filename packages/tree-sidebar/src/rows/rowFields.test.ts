import { allFieldNames, extraColumns } from './rowFields.ts'

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

  // Rows built by mapping a fixed field list (multi-wiggle's setRpcData) carry
  // explicitly-undefined keys, which Object.keys still reports. Such a field has
  // no values to show or group by, so it must not become a column.
  it('ignores keys that are undefined on every row', () => {
    const rows = [
      { name: 'a', labelColor: undefined, group: undefined },
      { name: 'b', labelColor: undefined, group: undefined },
    ]
    expect(extraColumns(rows, reserved)).toEqual([])
  })

  it('keeps a field that is set on at least one row', () => {
    const rows = [
      { name: 'a', labelColor: undefined },
      { name: 'b', labelColor: '#f00' },
    ]
    expect(extraColumns(rows, reserved)).toEqual(['labelColor'])
  })
})

describe('allFieldNames', () => {
  const reserved = new Set(['name', 'color'])

  // The shape counterpart to extraColumns: keeps keys no row has set, so the
  // CSV export can offer them as fillable headers.
  it('keeps keys that are undefined on every row', () => {
    const rows = [
      { name: 'a', group: undefined },
      { name: 'b', group: undefined },
    ]
    expect(allFieldNames(rows, reserved)).toEqual(['group'])
  })

  it('still honours the reserved set', () => {
    expect(allFieldNames([{ name: 'a', color: 'red' }], reserved)).toEqual([])
  })
})
