import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import HeightModeMixin from './HeightModeMixin.ts'
import TrackHeightMixin from './TrackHeightMixin.tsx'

import type { HeightModeHost } from './HeightModeMixin.ts'
import type { TrackHeightHost } from './TrackHeightMixin.tsx'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

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

// A scrolling display, shaped like the real ones: the scroll extent is what the
// content overruns the current height by, so it closes as the track grows.
const scrolling = (contentHeight: number) =>
  types
    .compose(
      'TestScrollingHeight',
      TrackHeightMixin(),
      types.model({
        type: types.literal('test'),
        configuration: configSchema,
      }),
    )
    .views(self => ({
      get scrollableHeight() {
        return Math.max(0, contentHeight - self.height)
      },
    }))
    .create({ type: 'test', configuration: { height: 100 } })

test('expandToContentHeight grows the track onto the hidden content', () => {
  const m = scrolling(340)
  expect(m.expandToContentHeight()).toBe(240)
  expect(m.height).toBe(340)
  expect(m.scrollableHeight).toBe(0)
})

test('expandToContentHeight is a no-op once everything fits', () => {
  const m = scrolling(80)
  expect(m.expandToContentHeight()).toBe(0)
  expect(m.height).toBe(100)
})

// The `Infinity` default — a display that doesn't scroll internally has no
// hidden content to expand onto, and must not be resized to it.
test('expandToContentHeight is a no-op for a non-scrolling display', () => {
  const m = create()
  expect(m.expandToContentHeight()).toBe(0)
  expect(m.height).toBe(100)
})

// Whichever `resizeHeight` the composed display ends up with is the one the
// expand has to go through — in practice `HeightModeMixin`'s, which leaves grow
// mode first. Writing the slot directly instead would leave grow mode's
// reactive height re-deriving `grownHeight`, and the double click would look
// like it did nothing.
test('expandToContentHeight goes through an overriding resizeHeight', () => {
  const distances: number[] = []
  const m = types
    .compose(
      'TestOverridingResize',
      TrackHeightMixin(),
      types.model({
        type: types.literal('test'),
        configuration: configSchema,
      }),
    )
    .views(() => ({
      get scrollableHeight() {
        return 50
      },
    }))
    .actions(() => ({
      resizeHeight(distance: number) {
        distances.push(distance)
        return distance
      },
    }))
    .create({ type: 'test', configuration: { height: 100 } })

  m.expandToContentHeight()
  expect(distances).toEqual([50])
  expect(m.height).toBe(100)
})

// The compose-order contract. `HeightModeMixin` overrides `height` and
// `resizeHeight`, and `types.compose` gives a collision to the later argument,
// so the wrong order silently drops grow mode. Writing the two the wrong way
// round in one `types.compose` is a `no-restricted-syntax` error; what these
// pin is the consequence the rule exists to prevent, which is the half a lint
// selector cannot state — and which the `supportsHeightModes` flag they used to
// read stood in for, because the flag was invented as a compose-order probe and
// nothing else ever read it.
//
// Grow mode is the state that tells the two orders apart at all: in fixed mode
// both `height` getters return the same slot, which is why the contract went
// unchecked for so long. So the fixture pins `heightMode` and `growTargetHeight`
// in its own trailing `.views()` — a display's two jobs under this mixin — and
// drag-resizes.
const heightModeConfig = ConfigurationSchema('TestHeightMode', {
  height: { type: 'number', defaultValue: 100 },
  growMaxHeight: { type: 'number', defaultValue: 1000 },
  heightMode: {
    type: 'stringEnum',
    model: types.enumeration(['fixed', 'grow', 'fit']),
    defaultValue: 'grow',
  },
})

function composeInOrder(...mixins: any[]) {
  return types
    .compose(
      'TestHeightModeOrder',
      types.compose('TestMixins', mixins[0], mixins[1]),
      types.model({
        type: types.literal('test'),
        configuration: heightModeConfig,
      }),
    )
    .views(() => ({
      // Pinned rather than resolved: `heightMode` is a promotable slot with no
      // session here to cascade through, and the mixin's default
      // `growTargetHeight` is the `height` slot itself, which would make grow
      // indistinguishable from fixed — the very collapse under test.
      get heightMode() {
        return 'grow' as const
      },
      get growTargetHeight() {
        return 300
      },
    }))
}

// `afterAttach` fires on attach to a parent, which is how a display is really
// created (it hangs off a track), so the fixture mounts one rather than a
// standalone root — and the parent is view-shaped (`width` + `setWidth`, which
// is what `getContainingView` looks for), since the mixin's grow-exit bake
// reads the view's `initialized` while in grow mode.
function mount(...mixins: any[]) {
  const Parent = types
    .model('TestView', {
      width: 800,
      display: composeInOrder(...mixins),
    })
    .views(() => ({
      get initialized() {
        return true
      },
    }))
    .actions(self => ({
      setWidth(width: number) {
        self.width = width
      },
    }))
  const { display } = Parent.create({
    display: { type: 'test', configuration: {} },
  })
  return display
}

test('the correct order leaves HeightModeMixin owning the drag-resize', () => {
  const display = mount(TrackHeightMixin(), HeightModeMixin())
  display.resizeHeight(30)
  // the grown height the user was seeing, plus the drag, and grow left first
  expect(display.configuration.height).toBe(330)
  expect(display.configuration.heightMode).toBe('fixed')
})

test('the wrong order silently leaves grow mode inert', () => {
  const display = mount(HeightModeMixin(), TrackHeightMixin())
  display.resizeHeight(30)
  // the base's `resizeHeight` won: it drags the raw slot, never sees the 300px
  // the track was displaying, and never leaves grow
  expect(display.configuration.height).toBe(130)
  expect(display.configuration.heightMode).toBe('grow')
})

// One line per mixin, and the whole point of it: a host cast widened back to
// `AnyConfigurationModel` — or written as the `ResolvableDisplay & { … }`
// intersection, which re-widens — compiles and checks nothing, so every slot
// name below it typechecks and a misspelled read reports nothing at any layer.
// `HostChecksSlotNames` resolves to `false` there, and this annotation fails.
const trackHeightPin: HostChecksSlotNames<TrackHeightHost> = true
const heightModePin: HostChecksSlotNames<HeightModeHost> = true
test('both height mixins check the slot names they read', () => {
  expect([trackHeightPin, heightModePin]).toEqual([true, true])
})
