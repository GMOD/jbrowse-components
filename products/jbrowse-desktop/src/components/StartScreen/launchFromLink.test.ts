import { launchFromLink } from './launchFromLink.ts'

import type { JBrowseConfig } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// loadSessionSpec drives real plugin extension points against a live root model;
// this exercises the link->config->spec wiring around it, so it stands in.
// (jest only allows a `mock`-prefixed binding inside a hoisted module factory.)
const mockLoadSessionSpec = jest.fn()
jest.mock('@jbrowse/app-core', () => ({
  ...jest.requireActual<object>('@jbrowse/app-core'),
  // called lazily: the factory is hoisted above the binding it closes over
  loadSessionSpec: (...args: unknown[]) => mockLoadSessionSpec(...args),
}))

const spec = {
  views: [{ type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-100' }],
}
const specLink = (query: string) =>
  `https://jbrowse.org/code/jb2/main/?${query}&session=spec-${encodeURIComponent(JSON.stringify(spec))}`
const link = `${specLink('config=test_data/volvox/config.json')}&sessionName=Figure`

const config: JBrowseConfig = {
  internetAccounts: [],
  assemblies: [{ name: 'volvox' }],
  tracks: [],
}
const pluginManager = {} as PluginManager
const resolvedConfigUrl =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

beforeEach(() => {
  mockLoadSessionSpec.mockReset()
})

test('fetches the config the link names, then builds the spec session on it', async () => {
  const fetchConfig = jest.fn().mockResolvedValue(config)
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  const result = await launchFromLink(link, {
    fetchConfig,
    createPluginManager,
  })

  // the link's config is relative to the instance it points at
  expect(fetchConfig).toHaveBeenCalledWith(resolvedConfigUrl)
  expect(createPluginManager).toHaveBeenCalledWith(config)
  expect(mockLoadSessionSpec).toHaveBeenCalledWith(
    { ...spec, sessionName: 'Figure' },
    pluginManager,
  )
  expect(result).toBe(pluginManager)
})

// openSpecLink vets a remote config's plugins inside its fetchConfig, so a
// rejection there must strand the link before any plugin javascript is loaded —
// createPluginManager is what reaches PluginLoader.
test('a config rejected by its plugin gate never builds a plugin manager', async () => {
  const fetchConfig = jest.fn().mockRejectedValue(new Error('not trusted'))
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await expect(
    launchFromLink(link, { fetchConfig, createPluginManager }),
  ).rejects.toThrow('not trusted')

  expect(createPluginManager).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
})

test('a spec carrying its own assemblies needs no config fetch', async () => {
  const selfContained = {
    views: [{ type: 'LinearGenomeView', assembly: 'mine' }],
    sessionAssemblies: [{ name: 'mine' }],
  }
  const fetchConfig = jest.fn()
  const createPluginManager = jest.fn().mockResolvedValue(pluginManager)

  await launchFromLink(
    `https://jbrowse.org/code/jb2/main/?session=spec-${encodeURIComponent(JSON.stringify(selfContained))}`,
    { fetchConfig, createPluginManager },
  )

  expect(fetchConfig).not.toHaveBeenCalled()
  expect(createPluginManager).toHaveBeenCalledWith(undefined)
  expect(mockLoadSessionSpec).toHaveBeenCalledWith(
    { ...selfContained, sessionName: undefined },
    pluginManager,
  )
})

test('a link only its own instance can open fails before anything is built', async () => {
  const fetchConfig = jest.fn()
  const createPluginManager = jest.fn()

  await expect(
    launchFromLink('https://jbrowse.org/code/jb2/main/?session=share-abc', {
      fetchConfig,
      createPluginManager,
    }),
  ).rejects.toThrow(/only the JBrowse Web instance that created it/)

  expect(fetchConfig).not.toHaveBeenCalled()
  expect(createPluginManager).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
})

test('a failed config fetch surfaces rather than building an empty session', async () => {
  const fetchConfig = jest.fn().mockRejectedValue(new Error('404 not found'))
  const createPluginManager = jest.fn()

  await expect(
    launchFromLink(link, { fetchConfig, createPluginManager }),
  ).rejects.toThrow('404 not found')

  expect(createPluginManager).not.toHaveBeenCalled()
  expect(mockLoadSessionSpec).not.toHaveBeenCalled()
})
