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

test('a display loads without a key it does not declare, and names it once', () => {
  const schema = ConfigurationSchema(
    'ProbeDisplay',
    { height: { type: 'number', defaultValue: 100 } },
    { explicitIdentifier: 'displayId', explicitlyTyped: true },
  )
  displayType(schema)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const entry = { type: 'ProbeDisplay', displayId: 'd', hieght: 5 }
  expect(schema.create(entry).height).toBe(100)
  schema.create(entry)
  expect(warn.mock.calls).toEqual([
    ['ProbeDisplay "d" does not declare hieght: loading without it'],
  ])
  schema.create({ type: 'ProbeDisplay', displayId: 'd', height: 5 })
  expect(warn).toHaveBeenCalledTimes(1)
  warn.mockRestore()
})

test('a display that opts out drops an undeclared key in silence', () => {
  const open = ConfigurationSchema(
    'OpenProbeDisplay',
    {},
    { explicitIdentifier: 'displayId', explicitlyTyped: true, closed: false },
  )
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  open.create({ type: 'OpenProbeDisplay', displayId: 'd', hieght: 5 })
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})
