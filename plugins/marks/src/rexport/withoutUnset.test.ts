import { withoutUnset } from './withoutUnset.ts'

describe('a resolved config read as settings', () => {
  it('drops the placeholders an unset slot resolves to', () => {
    expect(
      withoutUnset({
        color: { field: 'mapq', domain: [], range: [], labels: [] },
        facet: { field: '', domain: [] },
        baseColor: {},
        arcColor: { field: '' },
      }),
    ).toEqual({ color: { field: 'mapq' } })
  })

  it('keeps false, zero and non-empty lists, which are values', () => {
    expect(
      withoutUnset({
        reverse: false,
        domainQuantile: 0,
        filter: ['a'],
        scales: { y: { zero: false, rules: [] } },
      }),
    ).toEqual({
      reverse: false,
      domainQuantile: 0,
      filter: ['a'],
      scales: { y: { zero: false } },
    })
  })
})
