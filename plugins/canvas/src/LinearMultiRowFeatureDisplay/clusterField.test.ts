import { resolveClusterField } from './partitionFields.ts'

const base = {
  clusterField: 'auto',
  colorConfig: undefined as string | undefined,
  candidates: ['name', 'state', 'itemRgb', 'sample'],
  partitionField: 'sample',
}

describe('auto', () => {
  test('takes the attribute a jexl color expression reads', () => {
    expect(
      resolveClusterField({
        ...base,
        colorConfig: "jexl:get(feature,'state')=='TSS'?'red':'gray'",
      }),
    ).toBe('state')
    expect(
      resolveClusterField({ ...base, colorConfig: 'jexl:feature.state' }),
    ).toBe('state')
    expect(
      resolveClusterField({
        ...base,
        colorConfig: "jexl:get( feature, 'state' ) == 'TSS' ? 'red' : 'gray'",
      }),
    ).toBe('state')
  })

  test('ignores an attribute the loaded features do not carry', () => {
    expect(
      resolveClusterField({ ...base, colorConfig: "jexl:get(feature,'zzz')" }),
    ).toBe('name')
  })

  test('falls back to name for an itemRgb color and for no color at all', () => {
    expect(
      resolveClusterField({
        ...base,
        colorConfig: "jexl:`rgb(${get(feature,'itemRgb')})`",
      }),
    ).toBe('itemRgb')
    expect(resolveClusterField(base)).toBe('name')
    expect(resolveClusterField({ ...base, colorConfig: 'goldenrod' })).toBe(
      'name',
    )
  })

  test('clusters on presence where name is what the rows already are', () => {
    expect(resolveClusterField({ ...base, partitionField: 'name' })).toBe('')
  })

  test('clusters on presence where the features carry no name', () => {
    expect(resolveClusterField({ ...base, candidates: ['sample'] })).toBe('')
  })
})

test('an explicit slot value passes through, empty included', () => {
  expect(resolveClusterField({ ...base, clusterField: 'state' })).toBe('state')
  expect(resolveClusterField({ ...base, clusterField: '' })).toBe('')
  expect(
    resolveClusterField({
      ...base,
      clusterField: 'jexl:get(feature,"score")',
      colorConfig: "jexl:get(feature,'state')",
    }),
  ).toBe('jexl:get(feature,"score")')
})
