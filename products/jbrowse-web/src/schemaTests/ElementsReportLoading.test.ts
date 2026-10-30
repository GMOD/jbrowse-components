import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'

import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

// AppReadyMarker, jb.waitReady and the session thumbnail read an absent
// `displayPhase` or `showLoading` as finished, so a type that publishes none
// reads ready over a fetch still running

async function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const displays = pluginManager.getElementTypesInGroup(
    'display',
  ) as DisplayType[]
  const views = pluginManager.getElementTypesInGroup('view') as ViewType[]
  await Promise.all([...displays, ...views].map(t => t.loadStateModel()))
  return { pluginManager, displays, views }
}

function missing(instance: object, keys: string[]) {
  return keys.filter(k => !(k in instance))
}

test('every display type publishes displayPhase and svgReady', async () => {
  const { pluginManager, displays } = await setup()
  expect(displays.length).toBeGreaterThan(10)
  const gaps = displays.flatMap(t => {
    const display = t.stateModel.create(
      {
        type: t.name,
        configuration: t.configSchema.create({ displayId: 'x', type: t.name }),
      },
      { pluginManager },
    )
    const keys = missing(display, ['displayPhase', 'svgReady'])
    return keys.length ? [`${t.name}: ${keys.join(', ')}`] : []
  })
  expect(gaps).toEqual([])
})

test('every view type publishes showLoading, and an exporting one its init state', async () => {
  const { pluginManager, views } = await setup()
  expect(views.length).toBeGreaterThan(5)
  const gaps = views.flatMap(t => {
    const view = t.stateModel.create({ type: t.name }, { pluginManager })
    const keys = missing(
      view,
      'exportSvg' in view
        ? ['showLoading', 'initialized', 'error']
        : ['showLoading'],
    )
    return keys.length ? [`${t.name}: ${keys.join(', ')}`] : []
  })
  expect(gaps).toEqual([])
})
