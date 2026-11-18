import Plugin from '@jbrowse/core/Plugin'
import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

import { installedPluginInfo } from './util.ts'

import type { JBrowsePlugin } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const fooUrl = (version: string) =>
  `https://jbrowse.org/plugins/jbrowse-plugin-foo/${version}/dist/jbrowse-plugin-foo.umd.production.min.js`

const fooStoreEntry: JBrowsePlugin = {
  name: 'Foo',
  packageName: 'jbrowse-plugin-foo',
  authors: [],
  description: 'foo',
  location: 'https://example.com',
  license: 'MIT',
  url: fooUrl('2.0.0'),
  versions: [
    { pluginVersion: '2.0.0', jbrowseRange: '*', url: fooUrl('2.0.0') },
  ],
}

const barStoreEntry: JBrowsePlugin = {
  name: 'Bar',
  packageName: 'jbrowse-plugin-bar',
  authors: [],
  description: 'bar',
  location: 'https://example.com',
  license: 'MIT',
  url: 'https://jbrowse.org/plugins/jbrowse-plugin-bar/1.0.0/dist/bar.umd.js',
}

class FooRuntimePlugin extends Plugin {
  name = 'FooRuntimePlugin'
  version = '0.9.0'
}

function sessionWithSessionPlugin(definition: { name: string; url: string }) {
  const plugin = new FooRuntimePlugin()
  const session = createTestSession({
    sessionSnapshot: { sessionPlugins: [definition] },
    runtimePlugins: [{ plugin, definition }],
  })
  return { session, plugin }
}

test('a plugin installed from the store at an older version than the store offers', () => {
  const definition = { name: 'Foo', url: fooUrl('1.0.0') }
  const { session, plugin } = sessionWithSessionPlugin(definition)

  const info = installedPluginInfo(plugin, session, [
    barStoreEntry,
    fooStoreEntry,
  ])

  expect(info.definition).toEqual(definition)
  expect(info.storeEntry).toBe(fooStoreEntry)
  expect(info.installedVersion).toBe('1.0.0')
  expect(info.home).toBe('session')
  expect(info.isGlobal).toBe(false)
})

test('a plugin installed from a url the store does not list', () => {
  const definition = { name: 'Foo', url: 'https://example.com/foo.umd.js' }
  const { session, plugin } = sessionWithSessionPlugin(definition)

  const info = installedPluginInfo(plugin, session, [
    barStoreEntry,
    fooStoreEntry,
  ])

  expect(info.definition).toEqual(definition)
  expect(info.storeEntry).toBeUndefined()
  expect(info.installedVersion).toBeUndefined()
  expect(info.home).toBe('session')
})

test('with no store listing the plugin still has its definition and home', () => {
  const definition = { name: 'Foo', url: fooUrl('1.0.0') }
  const { session, plugin } = sessionWithSessionPlugin(definition)

  const info = installedPluginInfo(plugin, session, undefined)

  expect(info.definition).toEqual(definition)
  expect(info.storeEntry).toBeUndefined()
  expect(info.installedVersion).toBeUndefined()
  expect(info.home).toBe('session')
})

test('a global plugin has no home, so nothing offers to remove it', () => {
  const definition = { name: 'Foo', url: fooUrl('1.0.0') }
  const { session, plugin } = sessionWithSessionPlugin(definition)
  const { pluginManager } = getEnv(session)
  pluginManager.pluginMetadata[plugin.name] = {
    ...pluginManager.pluginMetadata[plugin.name],
    isGlobal: true,
  }

  const info = installedPluginInfo(plugin, session, [fooStoreEntry])

  expect(info.isGlobal).toBe(true)
  expect(info.home).toBeUndefined()
  expect(info.definition).toEqual(definition)
  expect(info.installedVersion).toBe('1.0.0')
})
