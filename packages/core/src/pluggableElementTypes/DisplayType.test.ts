import { ConfigurationSchema } from '../configuration/index.ts'
import DisplayType from './DisplayType.ts'

import type { AnyConfigurationSchemaType } from '../configuration/types.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

function displayType(configSchema: AnyConfigurationSchemaType) {
  return new DisplayType({
    name: 'ProbeDisplay',
    configSchema,
    stateModel: {} as IAnyModelType,
    trackType: 'FeatureTrack',
    viewType: 'LinearGenomeView',
    ReactComponent: () => null,
  })
}

test('a display refuses a key it does not declare, naming the slots it takes', () => {
  const schema = ConfigurationSchema(
    'ProbeDisplay',
    { height: { type: 'number', defaultValue: 100 } },
    { explicitIdentifier: 'displayId', explicitlyTyped: true, closed: true },
  )
  displayType(schema)
  expect(() =>
    schema.create({ type: 'ProbeDisplay', displayId: 'd', hieght: 5 }),
  ).toThrow('ProbeDisplay takes height, type and displayId, not hieght')
  expect(() =>
    schema.create({ type: 'ProbeDisplay', displayId: 'd', height: 5 }),
  ).not.toThrow()
})

test('an open schema is refused at registration', () => {
  const open = ConfigurationSchema(
    'ProbeDisplay',
    {},
    { explicitIdentifier: 'displayId', explicitlyTyped: true },
  )
  expect(() => displayType(open)).toThrow(
    "ProbeDisplay's config schema is not closed",
  )
})
