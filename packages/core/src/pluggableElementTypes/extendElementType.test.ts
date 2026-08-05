import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import DisplayType from './DisplayType.ts'
import ViewType from './ViewType.ts'
import { extendViewType } from './extendElementType.ts'

import type { AnyReactComponentType } from '../util/index.ts'

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
