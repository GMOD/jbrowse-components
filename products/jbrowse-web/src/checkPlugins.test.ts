import {
  checkPlugins,
  checkPluginsAgainstStore,
  fetchPlugins,
} from './checkPlugins.ts'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

// fills the required JBrowsePlugin metadata so tests can specify just urls
function store(entries: Partial<JBrowsePlugin>[]): {
  plugins: JBrowsePlugin[]
} {
  return {
    plugins: entries.map(e => ({
      name: 'StorePlugin',
      authors: [],
      description: '',
      location: '',
      license: '',
      ...e,
    })),
  }
}

describe('checkPluginsAgainstStore', () => {
  const mockStorePlugins = store([
    { umdUrl: 'https://example.com/plugin1.umd.js' },
    { url: 'https://example.com/plugin2.js' },
    { esmUrl: 'https://example.com/plugin3.esm.js' },
    { cjsUrl: 'https://example.com/plugin4.cjs.js' },
  ])

  it('returns true for empty plugin list', () => {
    expect(checkPluginsAgainstStore([], mockStorePlugins)).toBe(true)
  })

  it('returns true for UMD plugin with matching umdUrl', () => {
    const plugins: PluginDefinition[] = [
      { name: 'StorePlugin1', umdUrl: 'https://example.com/plugin1.umd.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
  })

  it('returns true for UMD plugin with matching legacy url', () => {
    const plugins: PluginDefinition[] = [
      { name: 'StorePlugin2', url: 'https://example.com/plugin2.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
  })

  it('returns true for ESM plugin with matching esmUrl', () => {
    const plugins: PluginDefinition[] = [
      { esmUrl: 'https://example.com/plugin3.esm.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
  })

  it('returns true for CJS plugin with matching cjsUrl', () => {
    const plugins: PluginDefinition[] = [
      { cjsUrl: 'https://example.com/plugin4.cjs.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
  })

  it('returns false for unknown UMD plugin', () => {
    const plugins: PluginDefinition[] = [
      { name: 'UnknownPlugin', umdUrl: 'https://evil.com/malicious.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(false)
  })

  it('returns false for unknown ESM plugin', () => {
    const plugins: PluginDefinition[] = [
      { esmUrl: 'https://evil.com/malicious.esm.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(false)
  })

  it('returns false for unknown CJS plugin', () => {
    const plugins: PluginDefinition[] = [
      { cjsUrl: 'https://evil.com/malicious.cjs.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(false)
  })

  it('returns false if any plugin in the list is unknown', () => {
    const plugins: PluginDefinition[] = [
      { name: 'StorePlugin1', umdUrl: 'https://example.com/plugin1.umd.js' },
      { name: 'UnknownPlugin', umdUrl: 'https://evil.com/malicious.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(false)
  })

  it('returns true for all known plugins', () => {
    const plugins: PluginDefinition[] = [
      { name: 'StorePlugin1', umdUrl: 'https://example.com/plugin1.umd.js' },
      { esmUrl: 'https://example.com/plugin3.esm.js' },
    ]
    expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
  })

  describe('versioned store entries', () => {
    const versionedStore = store([
      {
        url: 'https://example.com/plugin/3.0.0/plugin.umd.js',
        versions: [
          {
            pluginVersion: '1.4.0',
            jbrowseRange: '>=2.0.0 <3.0.0',
            url: 'https://example.com/plugin/1.4.0/plugin.umd.js',
          },
          {
            pluginVersion: '3.0.0',
            jbrowseRange: '>=3.0.0',
            url: 'https://example.com/plugin/3.0.0/plugin.umd.js',
          },
        ],
      },
    ])

    it('matches a version-pinned url from versions[]', () => {
      const plugins: PluginDefinition[] = [
        { name: 'P', url: 'https://example.com/plugin/1.4.0/plugin.umd.js' },
      ]
      expect(checkPluginsAgainstStore(plugins, versionedStore)).toBe(true)
    })

    it('rejects a url not in any version', () => {
      const plugins: PluginDefinition[] = [
        { name: 'P', url: 'https://example.com/plugin/9.9.9/plugin.umd.js' },
      ]
      expect(checkPluginsAgainstStore(plugins, versionedStore)).toBe(false)
    })
  })

  describe('trusted URL prefixes', () => {
    it('trusts plugins from https://jbrowse.org/plugins/', () => {
      const plugins: PluginDefinition[] = [
        {
          name: 'TrustedPlugin',
          umdUrl: 'https://jbrowse.org/plugins/MyPlugin/dist/plugin.umd.js',
        },
      ]
      expect(checkPluginsAgainstStore(plugins, { plugins: [] })).toBe(true)
    })

    it('trusts ESM plugins from https://jbrowse.org/plugins/', () => {
      const plugins: PluginDefinition[] = [
        { esmUrl: 'https://jbrowse.org/plugins/MyPlugin/dist/plugin.esm.js' },
      ]
      expect(checkPluginsAgainstStore(plugins, { plugins: [] })).toBe(true)
    })

    it('trusts CJS plugins from https://jbrowse.org/plugins/', () => {
      const plugins: PluginDefinition[] = [
        { cjsUrl: 'https://jbrowse.org/plugins/MyPlugin/dist/plugin.cjs.js' },
      ]
      expect(checkPluginsAgainstStore(plugins, { plugins: [] })).toBe(true)
    })

    it('does not trust similar-looking domains', () => {
      const plugins: PluginDefinition[] = [
        {
          name: 'EvilPlugin',
          umdUrl: 'https://jbrowse.org.evil.com/plugins/malicious.js',
        },
      ]
      expect(checkPluginsAgainstStore(plugins, { plugins: [] })).toBe(false)
    })

    it('does not trust http version of trusted prefix', () => {
      const plugins: PluginDefinition[] = [
        {
          name: 'InsecurePlugin',
          umdUrl: 'http://jbrowse.org/plugins/MyPlugin/dist/plugin.umd.js',
        },
      ]
      expect(checkPluginsAgainstStore(plugins, { plugins: [] })).toBe(false)
    })

    it('mixes trusted URLs and store-validated plugins', () => {
      const plugins: PluginDefinition[] = [
        {
          name: 'TrustedPlugin',
          umdUrl: 'https://jbrowse.org/plugins/MyPlugin/dist/plugin.umd.js',
        },
        {
          name: 'StorePlugin1',
          umdUrl: 'https://example.com/plugin1.umd.js',
        },
      ]
      expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
    })
  })
})

describe('checkPlugins with real plugin store', () => {
  // fetch is mocked globally (config/jest/fetchMockAfterEnv.js); just clear
  // queued responses and call history before each test so the fetch-count
  // assertions below start clean.
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  it('validates mafviewer plugin from plugins.json', async () => {
    const mockPluginsJson = {
      plugins: [
        {
          name: 'MafViewer',
          url: 'https://jbrowse.org/plugins/jbrowse-plugin-mafviewer/dist/jbrowse-plugin-mafviewer.umd.production.min.js',
        },
      ],
    }
    fetchMock.mockResponseOnce(JSON.stringify(mockPluginsJson))

    const storePlugins = await fetchPlugins()
    const plugins: PluginDefinition[] = [
      {
        name: 'MafViewer',
        url: 'https://jbrowse.org/plugins/jbrowse-plugin-mafviewer/dist/jbrowse-plugin-mafviewer.umd.production.min.js',
      },
    ]
    expect(checkPluginsAgainstStore(plugins, storePlugins)).toBe(true)
  })

  it('rejects unknown plugin not in plugins.json', async () => {
    const mockPluginsJson = {
      plugins: [
        {
          name: 'MafViewer',
          url: 'https://jbrowse.org/plugins/jbrowse-plugin-mafviewer/dist/jbrowse-plugin-mafviewer.umd.production.min.js',
        },
      ],
    }
    fetchMock.mockResponseOnce(JSON.stringify(mockPluginsJson))

    const storePlugins = await fetchPlugins()
    const plugins: PluginDefinition[] = [
      {
        name: 'FakePlugin',
        url: 'https://evil.com/fake-plugin.umd.js',
      },
    ]
    expect(checkPluginsAgainstStore(plugins, storePlugins)).toBe(false)
  })

  it('skips the store fetch for an empty plugin list', async () => {
    await expect(checkPlugins([])).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trusts prefix-trusted plugins without fetching the store', async () => {
    const plugins: PluginDefinition[] = [
      {
        name: 'TrustedPlugin',
        url: 'https://jbrowse.org/plugins/MyPlugin/dist/plugin.umd.js',
      },
    ]
    await expect(checkPlugins(plugins)).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the store when a plugin is not trusted by prefix', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ plugins: [] }))
    const plugins: PluginDefinition[] = [
      { name: 'UntrustedPlugin', url: 'https://example.com/plugin.umd.js' },
    ]
    await expect(checkPlugins(plugins)).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
