import { checkPluginsAgainstStore, fetchPlugins } from './checkPlugins'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

describe('checkPluginsAgainstStore', () => {
  const mockStorePlugins: { plugins: PluginDefinition[] } = {
    plugins: [
      { name: 'StorePlugin1', umdUrl: 'https://example.com/plugin1.umd.js' },
      { name: 'StorePlugin2', url: 'https://example.com/plugin2.js' },
      { esmUrl: 'https://example.com/plugin3.esm.js' },
      { cjsUrl: 'https://example.com/plugin4.cjs.js' },
      {
        name: 'StorePluginLoc',
        umdLoc: { uri: 'plugin5.umd.js', baseUri: 'https://example.com/' },
      },
      { esmLoc: { uri: 'plugin6.esm.js', baseUri: 'https://example.com/' } },
    ],
  }

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

  describe('umdLoc format', () => {
    it('matches plugin defined with umdLoc against store with umdLoc', () => {
      const plugins: PluginDefinition[] = [
        {
          name: 'TestPlugin',
          umdLoc: { uri: 'plugin5.umd.js', baseUri: 'https://example.com/' },
        },
      ]
      expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
    })
  })

  describe('esmLoc format', () => {
    it('matches plugin defined with esmLoc against store with esmLoc', () => {
      const plugins: PluginDefinition[] = [
        { esmLoc: { uri: 'plugin6.esm.js', baseUri: 'https://example.com/' } },
      ]
      expect(checkPluginsAgainstStore(plugins, mockStorePlugins)).toBe(true)
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
  beforeEach(() => {
    // @ts-expect-error
    fetch.enableMocks()
  })

  afterEach(() => {
    // @ts-expect-error
    fetch.resetMocks()
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
    // @ts-expect-error
    fetch.mockResponseOnce(JSON.stringify(mockPluginsJson))

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
    // @ts-expect-error
    fetch.mockResponseOnce(JSON.stringify(mockPluginsJson))

    const storePlugins = await fetchPlugins()
    const plugins: PluginDefinition[] = [
      {
        name: 'FakePlugin',
        url: 'https://evil.com/fake-plugin.umd.js',
      },
    ]
    expect(checkPluginsAgainstStore(plugins, storePlugins)).toBe(false)
  })
})
