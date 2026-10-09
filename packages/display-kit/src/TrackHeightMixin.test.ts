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
      get scrollContentHeight() {
        return contentHeight
      },
      get scrollViewportHeight() {
        return self.height
      },
    }))
    .create({ type: 'test', configuration: { height: 100 } })

// A fit mode divides the viewport across n rows and multiplies back, which
// lands a few ULPs over it for about one row count in twenty — 11 rows at the
// variant displays' default height among them.
test('a sub-pixel overflow is no scroll at all', () => {
  const m = scrolling((100 / 11) * 11)
  expect(m.scrollContentHeight).toBeGreaterThan(m.scrollViewportHeight)
  expect(m.scrollableHeight).toBe(0)
  m.setScrollTop(10)
  expect(m.scrollTop).toBe(0)
})

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

// A display that doesn't scroll internally has no hidden content to expand
// onto, and must not be resized to it.
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
      get scrollContentHeight() {
        return 150
      },
      get scrollViewportHeight() {
        return 100
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

// `HeightModeMixin` composes `TrackHeightMixin` and overrides its `height` and
// `resizeHeight`. Grow mode is the state that tells the override from the base
// at all: in fixed mode both `height` getters return the same slot. So the
// fixture pins `heightMode` and `growTargetHeight` in its own trailing
// `.views()` — a display's two jobs under this mixin — and drag-resizes.
const heightModeConfig = ConfigurationSchema('TestHeightMode', {
  height: { type: 'number', defaultValue: 100 },
  growMaxHeight: { type: 'number', defaultValue: 1000 },
  heightMode: {
    type: 'stringEnum',
    model: types.enumeration(['fixed', 'grow', 'fit']),
    defaultValue: 'grow',
  },
})

function withHeightMode() {
  return types
    .compose(
      'TestHeightMode',
      HeightModeMixin(),
      types.model({
        type: types.literal('test'),
        configuration: heightModeConfig,
      }),
    )
    .views(() => ({
      // Pinned rather than read off the slot: the mixin's default
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
function mount() {
  const Parent = types
    .model('TestView', {
      width: 800,
      display: withHeightMode(),
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

test('HeightModeMixin owns the drag-resize over the TrackHeightMixin it composes', () => {
  const display = mount()
  display.resizeHeight(30)
  // the grown height the user was seeing, plus the drag, and grow left first
  expect(display.configuration.height).toBe(330)
  expect(display.configuration.heightMode).toBe('fixed')
})

test('a host height is what the fit target reads, and the slot stays put', () => {
  const display = mount()
  display.setHostHeight(80)
  expect(display.fitTargetHeight).toBe(80)
  expect(display.configuredHeight).toBe(100)
  expect(display.configuration.height).toBe(100)
})

// One line per mixin, and the whole point of it: a host cast widened back to
// `AnyConfigurationModel` compiles and checks nothing, so every slot name below
// it typechecks and a misspelled read reports nothing at any layer.
// `HostChecksSlotNames` resolves to `false` there, and this annotation fails.
const trackHeightPin: HostChecksSlotNames<TrackHeightHost> = true
const heightModePin: HostChecksSlotNames<HeightModeHost> = true
test('both height mixins check the slot names they read', () => {
  expect([trackHeightPin, heightModePin]).toEqual([true, true])
})
