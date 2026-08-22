import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { MultipleViewsSessionMixin } from './MultipleViews.ts'

function fakeViewModel(name: string) {
  return types.model(name, {
    id: ElementId,
    type: types.literal(name),
    displayName: types.maybe(types.string),
  })
}

// One plugin manager per test: loading a lazy state model mutates its
// ViewType, so a shared manager would make the tests order-dependent.
function setup() {
  class LazyViewPlugin extends Plugin {
    name = 'LazyViewPlugin'

    install(pluginManager: PluginManager) {
      pluginManager.addViewType(
        () =>
          new ViewType({
            name: 'FakeEagerView',
            stateModel: fakeViewModel('FakeEagerView'),
            ReactComponent: () => null,
          }),
      )
      pluginManager.addViewType(
        () =>
          new ViewType({
            name: 'FakeLazyView',
            stateModel: () => Promise.resolve(fakeViewModel('FakeLazyView')),
            ReactComponent: () => null,
          }),
      )
      pluginManager.addWidgetType(
        () =>
          new WidgetType({
            name: 'FakeViewWidget',
            stateModel: types.model('FakeViewWidget', {
              id: ElementId,
              type: types.literal('FakeViewWidget'),
              view: types.safeReference(
                pluginManager.pluggableMstType('view', 'stateModel'),
              ),
            }),
            configSchema: ConfigurationSchema('FakeViewWidget', {}),
            ReactComponent: () => null,
          }),
      )
    }
  }
  const pluginManager = new PluginManager([new LazyViewPlugin()])
    .createPluggableElements()
    .configure()
  const sessionModel = MultipleViewsSessionMixin(pluginManager)
  return { pluginManager, sessionModel }
}

test('a lazy view type reports unloaded until its loader resolves', async () => {
  const { pluginManager } = setup()
  const viewType = pluginManager.getViewType('FakeLazyView')
  expect(viewType.isStateModelLoaded).toBe(false)
  await viewType.loadStateModel()
  expect(viewType.isStateModelLoaded).toBe(true)
  expect(viewType.stateModel.name).toBe('FakeLazyView')
})

test('addView of an unloaded lazy view type throws an actionable error', () => {
  const { pluginManager, sessionModel } = setup()
  const session = sessionModel.create({ name: 'test' }, { pluginManager })
  expect(() => session.addView('FakeLazyView')).toThrow(/use launchView/)
})

test('launchView loads the state model and adds the view', async () => {
  const { pluginManager, sessionModel } = setup()
  const session = sessionModel.create({ name: 'test' }, { pluginManager })
  const view = await session.launchView('FakeLazyView', {
    displayName: 'mine',
  })
  expect(session.views.length).toBe(1)
  expect(view.type).toBe('FakeLazyView')
  expect(view.displayName).toBe('mine')
})

test('a session snapshot naming a lazy view type casts after preloadViewTypes', async () => {
  const { pluginManager, sessionModel } = setup()
  const snapshot = {
    name: 'test',
    views: [
      { id: 'e', type: 'FakeEagerView' },
      { id: 'l', type: 'FakeLazyView' },
    ],
  }
  await pluginManager.preloadViewTypes(snapshot)
  const session = sessionModel.create(snapshot, { pluginManager })
  expect(session.views.map(v => v.type)).toEqual([
    'FakeEagerView',
    'FakeLazyView',
  ])
  expect(getSnapshot(session).views).toEqual(snapshot.views)
})

test('a widget safeReference resolves a lazily loaded view', async () => {
  const { pluginManager, sessionModel } = setup()
  const session = sessionModel.create({ name: 'test' }, { pluginManager })
  const view = await session.launchView('FakeLazyView')
  const widget = session.addWidget('FakeViewWidget', 'w1', { view: view.id })
  expect(widget.view).toBe(view)
})

test('extensions registered before the loader resolves compose onto the loaded model', async () => {
  const { pluginManager } = setup()
  const viewType = pluginManager.getViewType('FakeLazyView')
  viewType.extendStateModel(stateModel =>
    stateModel.views(() => ({
      get extended() {
        return 'yes'
      },
    })),
  )
  const loaded = await viewType.loadStateModel()
  const instance = loaded.create({ id: 'x', type: 'FakeLazyView' })
  expect((instance as { extended?: string }).extended).toBe('yes')
})
