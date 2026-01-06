import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { getTypeNamesFromExplicitlyTypedUnion } from './util.ts'

describe('getTypeNamesFromExplicitlyTypedUnion', () => {
  test('regular config schemas', () => {
    const one = ConfigurationSchema('One', {}, { explicitlyTyped: true })
    const two = ConfigurationSchema('Two', {}, { explicitlyTyped: true })
    const u = types.union(one, two)

    const names = getTypeNamesFromExplicitlyTypedUnion(u)
    expect(names).toEqual(['One', 'Two'])
  })
  test('late config schemas', () => {
    const one = ConfigurationSchema('One', {}, { explicitlyTyped: true })
    const two = types.late(() =>
      ConfigurationSchema('Two', {}, { explicitlyTyped: true }),
    )
    const u = types.union(one, two)

    const names = getTypeNamesFromExplicitlyTypedUnion(u)
    expect(names).toEqual(['One', 'Two'])
  })
})
