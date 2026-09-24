// Why `getConf` is not redundant with `readConfObject`, which its own docstring
// makes it look ("exactly `readConfObject(model.configuration, path)`"). That is
// true of what it computes and beside the point: `readConfObject` reads
// `confObject[slotName]`, so handed a state model instead of that model's
// config it reads the MODEL's member. Both ways it goes wrong are silent, and
// the second returns a confident wrong number rather than nothing.
//
// A review proposed cutting `jb.getConf` off the agent surface on the strength
// of that docstring. The jb roster's criterion is "a helper that turns a silent
// wrong answer into a throw or a report" — this is one, for untyped code in
// run_javascript where the slot-name types buy nothing.
import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { getConf } from './getConf.ts'
import { readConfObject } from './readConfObject.ts'

import type { AnyConfigurationModel } from './types.ts'

const schema = ConfigurationSchema(
  'GetConfTest',
  { height: { type: 'number', defaultValue: 100 } },
  { explicitIdentifier: 'displayId' },
)

// `resolution` is a model property and NOT a slot, the shape the wiggle
// displays have
const Model = types.model({ configuration: schema, resolution: 1 })

const model = () =>
  Model.create({ configuration: { displayId: 'd1', height: 55 } })

test('getConf makes the .configuration hop', () => {
  expect(getConf(model(), 'height')).toBe(55)
})

test('readConfObject handed the model reads nothing, and says nothing', () => {
  expect(
    readConfObject(model() as unknown as AnyConfigurationModel, 'height'),
  ).toBeUndefined()
})

test('readConfObject handed the model answers with a property that is no slot', () => {
  // the trap worth a helper: 1 is the model's own `resolution`, and there is no
  // `resolution` slot for it to have come from
  expect(
    readConfObject(model() as unknown as AnyConfigurationModel, 'resolution'),
  ).toBe(1)
  expect(getConf(model() as never, 'resolution')).toBeUndefined()
})
