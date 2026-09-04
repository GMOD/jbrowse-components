import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import { defineLaunchKeys, withLaunchInput } from '../util/withLaunchInput.ts'
import DisplayType from './DisplayType.ts'
import ViewType from './ViewType.ts'
import { extendViewType } from './extendElementType.ts'

import type { AnyReactComponentType } from '../util/index.ts'
import type { LaunchInput } from '../util/withLaunchInput.ts'

// The point fires for every pluggable element there is, so the thing worth
// asserting is that a contribution reaches its own element and nothing else.
declare module '../PluginManager.ts' {
  interface ViewTypeRegistry {
    TestViewA: typeof baseModel
    TestViewB: typeof baseModel
  }
}

const baseModel = types.model('TestView', {
  id: types.optional(types.identifier, 'v'),
  type: types.string,
})

const ReactComponent = (() => null) as unknown as AnyReactComponentType

function addViews(pm: PluginManager) {
  for (const name of ['TestViewA', 'TestViewB'] as const) {
    pm.addViewType(
      () => new ViewType({ name, stateModel: baseModel, ReactComponent }),
    )
  }
  pm.createPluggableElements()
}

test('extends only the named view type', () => {
  const pm = new PluginManager([])
  extendViewType(pm, 'TestViewA', stateModel =>
    stateModel.actions(() => ({ marked: () => 'A' })),
  )
  addViews(pm)

  const a = pm.getViewType('TestViewA').stateModel.create({ type: 'TestViewA' })
  const b = pm.getViewType('TestViewB').stateModel.create({ type: 'TestViewB' })
  expect((a as unknown as { marked: () => string }).marked()).toBe('A')
  expect((b as unknown as { marked?: unknown }).marked).toBeUndefined()
})

test('two plugins extending one view type both apply', () => {
  const pm = new PluginManager([])
  extendViewType(pm, 'TestViewA', stateModel =>
    stateModel.actions(() => ({ first: () => 1 })),
  )
  extendViewType(pm, 'TestViewA', stateModel =>
    stateModel.actions(() => ({ second: () => 2 })),
  )
  addViews(pm)

  const a = pm
    .getViewType('TestViewA')
    .stateModel.create({ type: 'TestViewA' }) as unknown as {
    first: () => number
    second: () => number
  }
  expect(a.first()).toBe(1)
  expect(a.second()).toBe(2)
})

test('a display sharing the name is not reached, because the group is checked', () => {
  const pm = new PluginManager([])
  extendViewType(pm, 'TestViewA', stateModel =>
    stateModel.actions(() => ({ marked: () => 'A' })),
  )
  pm.addDisplayType(
    () =>
      new DisplayType({
        name: 'TestViewA',
        configSchema: ConfigurationSchema('TestViewA', {}),
        stateModel: baseModel,
        trackType: 'FeatureTrack',
        viewType: 'TestViewA',
        ReactComponent,
      }),
  )
  addViews(pm)

  const display = pm
    .getDisplayType('TestViewA')
    .stateModel.create({ type: 'TestViewA' })
  // the name matches; only the group tells them apart
  expect((display as unknown as { marked?: unknown }).marked).toBeUndefined()
})

// The point fires inside createPluggableElements, so a registration after that
// run joins a fold that has already happened. `addElementType` throws on the
// same mistake; this used to accept the callback, run nothing, and leave the
// author with a view type that was simply never extended — from `configure()`
// rather than `install()`, which is a one-word slip.
test('registering after createPluggableElements throws instead of no-opping', () => {
  const pm = new PluginManager([])
  addViews(pm)
  expect(() => {
    extendViewType(pm, 'TestViewA', stateModel => stateModel)
  }).toThrow(/after createPluggableElements/)
})

// The documented pattern — `types.compose(m, types.model({ myProp: false }))` —
// adds a property AFTER the factory's `withLaunchInput` wrapped the model. The
// partition used to classify against the properties it saw at wrap time, so the
// added one restored at its default with a warning calling it a typo.
test('a property added by extendViewType survives a snapshot round trip', () => {
  console.warn = jest.fn()
  const pm = new PluginManager([])
  const launchKeys = defineLaunchKeys<{ assembly?: string }>()({
    assembly: { kind: 'launch' },
  })
  const wrapped = withLaunchInput(
    baseModel.props({
      launch: types.frozen<LaunchInput<unknown> | undefined>(),
    }),
    launchKeys,
    pm,
  )
  extendViewType(pm, 'TestViewA', stateModel =>
    types.compose(stateModel, types.model({ myProp: false })),
  )
  pm.addViewType(
    () =>
      new ViewType({
        name: 'TestViewA',
        stateModel: wrapped,
        launchKeys,
        ReactComponent,
      }),
  )
  pm.createPluggableElements()

  const Holder = types.model({ view: pm.getViewType('TestViewA').stateModel })
  const { view } = Holder.create({
    view: { type: 'TestViewA', myProp: true },
  }) as unknown as { view: { myProp: boolean; launch?: LaunchInput<unknown> } }
  expect(view.myProp).toBe(true)
  expect(view.launch).toBeUndefined()
  expect(getSnapshot(view)).toMatchObject({ myProp: true })
  expect(console.warn).not.toHaveBeenCalled()
})
