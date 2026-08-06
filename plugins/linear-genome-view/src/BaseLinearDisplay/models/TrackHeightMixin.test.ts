import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import HeightModeMixin from './HeightModeMixin.ts'
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

// The compose-order contract. `HeightModeMixin` overrides `height` and
// `resizeHeight`, and `types.compose` gives a collision to the later argument,
// so the wrong order silently drops grow mode — and the two `height` getters
// agree in fixed mode, so nothing about the *value* distinguishes them. The
// flag is what does, and the mixin reads it back at attach.
//
// ARCHITECTURAL_LIMITS.md listed this as the last unchecked ordering contract.
const heightModeConfig = ConfigurationSchema('TestHeightMode', {
  height: { type: 'number', defaultValue: 100 },
  heightMode: { type: 'stringEnum', model: types.enumeration(['fixed', 'grow', 'fit']), defaultValue: 'fixed' },
})

function composeInOrder(...mixins: any[]) {
  return types.compose(
    'TestHeightModeOrder',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    types.compose('TestMixins', mixins[0], mixins[1]),
    types.model({
      type: types.literal('test'),
      configuration: heightModeConfig,
    }),
  )
}

// `afterAttach` fires on attach to a parent, which is how a display is really
// created (it hangs off a track), so the fixture mounts one rather than a
// standalone root.
function mount(...mixins: any[]) {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const Parent = types.model('TestTrack', { display: composeInOrder(...mixins) })
  const { display } = Parent.create({
    display: { type: 'test', configuration: {} },
  })
  return { display, spy }
}

test('the correct order leaves HeightModeMixin owning the height', () => {
  const { display, spy } = mount(TrackHeightMixin(), HeightModeMixin())
  expect(display.supportsHeightModes).toBe(true)
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})

test('the wrong order reports itself at attach', () => {
  const { display, spy } = mount(HeightModeMixin(), TrackHeightMixin())
  // the base's `false` won, and with it the base's `height`/`resizeHeight`
  expect(display.supportsHeightModes).toBe(false)
  expect(spy).toHaveBeenCalledWith(
    expect.stringContaining('must be composed AFTER TrackHeightMixin()'),
  )
  spy.mockRestore()
})
