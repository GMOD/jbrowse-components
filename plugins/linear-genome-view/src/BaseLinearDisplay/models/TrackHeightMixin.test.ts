import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import TrackHeightMixin from './TrackHeightMixin.tsx'

const configSchema = ConfigurationSchema('TestHeight', {
  height: { type: 'number', defaultValue: 100 },
})

// The height now lives on the `height` config slot, so the test model needs a
// real configuration node with that slot for the getter/setters to resolve.
const TestModel = types.compose(
  'TestHeight',
  TrackHeightMixin(),
  types.model({
    type: types.literal('test'),
    configuration: configSchema,
  }),
)

const create = () =>
  TestModel.create({ type: 'test', configuration: { height: 100 } })

test('height resolves to the config slot default', () => {
  expect(create().height).toBe(100)
})

test('setHeight writes the config height slot', () => {
  const m = create()
  m.setHeight(220)
  expect(m.height).toBe(220)
  expect(m.configuration.height).toBe(220)
})

test('resizeHeight adjusts the config height slot', () => {
  const m = create()
  m.setHeight(220)
  m.resizeHeight(30)
  expect(m.height).toBe(250)
})

test('setHeight clamps to the minimum display height', () => {
  const m = create()
  m.setHeight(5)
  expect(m.height).toBe(20)
})
