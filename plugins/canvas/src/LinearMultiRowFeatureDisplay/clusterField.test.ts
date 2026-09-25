import { resolveClusterField } from './partitionFields.ts'

const base = {
  clusterField: 'auto',
  color: { value: undefined as string | undefined, field: '' },
  candidates: ['name', 'state', 'itemRgb', 'sample'],
  partitionField: 'sample',
}

describe('auto', () => {
  test('takes the attribute a jexl color expression reads', () => {
    expect(
      resolveClusterField({
        ...base,
        color: {
          value: "jexl:get(feature,'state')=='TSS'?'red':'gray'",
          field: '',
        },
      }),
    ).toBe('state')
    expect(
      resolveClusterField({
        ...base,
        color: { value: 'jexl:feature.state', field: '' },
      }),
    ).toBe('state')
    expect(
      resolveClusterField({
        ...base,
        color: {
          value: "jexl:get( feature, 'state' ) == 'TSS' ? 'red' : 'gray'",
          field: '',
        },
      }),
    ).toBe('state')
  })

  test('ignores an attribute the loaded features do not carry', () => {
    expect(
      resolveClusterField({
        ...base,
        color: { value: "jexl:get(feature,'zzz')", field: '' },
      }),
    ).toBe('name')
  })

  test('falls back to name for an itemRgb color and for no color at all', () => {
    expect(
      resolveClusterField({
        ...base,
        color: { value: "jexl:`rgb(${get(feature,'itemRgb')})`", field: '' },
      }),
    ).toBe('itemRgb')
    expect(resolveClusterField(base)).toBe('name')
    expect(
      resolveClusterField({
        ...base,
        color: { value: 'goldenrod', field: '' },
      }),
    ).toBe('name')
  })

  test('clusters on presence where name is what the rows already are', () => {
    expect(resolveClusterField({ ...base, partitionField: 'name' })).toBe('')
  })

  test('clusters on presence where the features carry no name', () => {
    expect(resolveClusterField({ ...base, candidates: ['sample'] })).toBe('')
  })
})

test('takes the field a colour object names outright', () => {
  expect(
    resolveClusterField({
      ...base,
      color: { value: undefined, field: 'state' },
    }),
  ).toBe('state')
})

test('an explicit slot value passes through, empty included', () => {
  expect(resolveClusterField({ ...base, clusterField: 'state' })).toBe('state')
  expect(resolveClusterField({ ...base, clusterField: '' })).toBe('')
  expect(
    resolveClusterField({
      ...base,
      clusterField: 'jexl:get(feature,"score")',
      color: { value: "jexl:get(feature,'state')", field: '' },
    }),
  ).toBe('jexl:get(feature,"score")')
})
