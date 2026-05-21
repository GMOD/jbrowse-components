import {
  dedupePlugins,
  isCJSPluginDefinition,
  isESMPluginDefinition,
  isUMDPluginDefinition,
  pluginDefinitionMetadata,
  pluginLabel,
  pluginUrl,
} from './PluginLoader.ts'

import type { PluginDefinition } from './PluginLoader.ts'

describe('pluginUrl', () => {
  it('extracts url from legacy UMD plugin', () => {
    expect(
      pluginUrl({ name: 'Test', url: 'https://example.com/plugin.js' }),
    ).toBe('https://example.com/plugin.js')
  })

  it('extracts url from UMD plugin with umdUrl', () => {
    expect(
      pluginUrl({ name: 'Test', umdUrl: 'https://example.com/plugin.umd.js' }),
    ).toBe('https://example.com/plugin.umd.js')
  })

  it('extracts url from UMD plugin with umdLoc', () => {
    expect(
      pluginUrl({
        name: 'Test',
        umdLoc: { uri: 'plugin.umd.js', baseUri: 'https://example.com/' },
      }),
    ).toBe('plugin.umd.js')
  })

  it('extracts url from ESM plugin with esmUrl', () => {
    expect(pluginUrl({ esmUrl: 'https://example.com/plugin.esm.js' })).toBe(
      'https://example.com/plugin.esm.js',
    )
  })

  it('extracts url from ESM plugin with esmLoc', () => {
    expect(
      pluginUrl({
        esmLoc: { uri: 'plugin.esm.js', baseUri: 'https://example.com/' },
      }),
    ).toBe('plugin.esm.js')
  })

  it('extracts url from CJS plugin', () => {
    expect(pluginUrl({ cjsUrl: 'https://example.com/plugin.cjs.js' })).toBe(
      'https://example.com/plugin.cjs.js',
    )
  })

  it('returns unknown url for unrecognized plugin type', () => {
    expect(pluginUrl({} as PluginDefinition)).toBe('unknown url')
  })
})

describe('pluginDefinitionMetadata', () => {
  it('returns name and url for legacy UMD plugin', () => {
    const meta = pluginDefinitionMetadata({
      name: 'Test',
      url: 'https://example.com/plugin.js',
    })
    expect(meta).toEqual({
      name: 'Test',
      url: 'https://example.com/plugin.js',
    })
  })

  it('returns name and url for UMD plugin', () => {
    const meta = pluginDefinitionMetadata({
      name: 'Test',
      umdUrl: 'https://example.com/plugin.umd.js',
    })
    expect(meta).toEqual({
      name: 'Test',
      url: 'https://example.com/plugin.umd.js',
    })
  })

  it('returns url without name for ESM plugin', () => {
    const meta = pluginDefinitionMetadata({
      esmUrl: 'https://example.com/plugin.esm.js',
    })
    expect(meta).toEqual({
      name: undefined,
      url: 'https://example.com/plugin.esm.js',
    })
  })

  it('returns url without name for CJS plugin', () => {
    const meta = pluginDefinitionMetadata({
      cjsUrl: 'https://example.com/plugin.cjs.js',
    })
    expect(meta).toEqual({
      name: undefined,
      url: 'https://example.com/plugin.cjs.js',
    })
  })
})

describe('pluginLabel', () => {
  it('includes name and url for named plugins', () => {
    expect(
      pluginLabel({ name: 'MyPlugin', umdUrl: 'https://example.com/p.js' }),
    ).toBe('MyPlugin (https://example.com/p.js)')
  })

  it('returns just url for unnamed plugins', () => {
    expect(pluginLabel({ esmUrl: 'https://example.com/p.esm.js' })).toBe(
      'https://example.com/p.esm.js',
    )
  })
})

describe('type guards', () => {
  it('identifies legacy UMD plugin', () => {
    const d: PluginDefinition = {
      name: 'Test',
      url: 'https://example.com/plugin.js',
    }
    expect(isUMDPluginDefinition(d)).toBe(true)
    expect(isESMPluginDefinition(d)).toBe(false)
    expect(isCJSPluginDefinition(d)).toBe(false)
  })

  it('identifies UMD url plugin', () => {
    const d: PluginDefinition = {
      name: 'Test',
      umdUrl: 'https://example.com/plugin.umd.js',
    }
    expect(isUMDPluginDefinition(d)).toBe(true)
    expect(isESMPluginDefinition(d)).toBe(false)
    expect(isCJSPluginDefinition(d)).toBe(false)
  })

  it('identifies UMD loc plugin', () => {
    const d: PluginDefinition = {
      name: 'Test',
      umdLoc: { uri: 'plugin.umd.js' },
    }
    expect(isUMDPluginDefinition(d)).toBe(true)
  })

  it('identifies ESM url plugin', () => {
    const d: PluginDefinition = {
      esmUrl: 'https://example.com/plugin.esm.js',
    }
    expect(isUMDPluginDefinition(d)).toBe(false)
    expect(isESMPluginDefinition(d)).toBe(true)
    expect(isCJSPluginDefinition(d)).toBe(false)
  })

  it('identifies ESM loc plugin', () => {
    const d: PluginDefinition = {
      esmLoc: { uri: 'plugin.esm.js' },
    }
    expect(isESMPluginDefinition(d)).toBe(true)
  })

  it('identifies CJS plugin', () => {
    const d: PluginDefinition = {
      cjsUrl: 'https://example.com/plugin.cjs.js',
    }
    expect(isUMDPluginDefinition(d)).toBe(false)
    expect(isESMPluginDefinition(d)).toBe(false)
    expect(isCJSPluginDefinition(d)).toBe(true)
  })
})

describe('dedupePlugins', () => {
  it('removes duplicate by name', () => {
    const plugins: PluginDefinition[] = [
      { name: 'MyPlugin', umdUrl: 'https://example.com/a.js' },
      { name: 'MyPlugin', umdUrl: 'https://example.com/b.js' },
    ]
    const result = dedupePlugins(plugins)
    expect(result).toHaveLength(1)
    expect(pluginUrl(result[0]!)).toBe('https://example.com/a.js')
  })

  it('removes duplicate by URL', () => {
    const plugins: PluginDefinition[] = [
      { name: 'Plugin1', umdUrl: 'https://example.com/same.js' },
      { name: 'Plugin2', umdUrl: 'https://example.com/same.js' },
    ]
    const result = dedupePlugins(plugins)
    expect(result).toHaveLength(1)
    expect(result[0]!).toEqual({
      name: 'Plugin1',
      umdUrl: 'https://example.com/same.js',
    })
  })

  it('keeps plugins with different names and URLs', () => {
    const plugins: PluginDefinition[] = [
      { name: 'Plugin1', umdUrl: 'https://example.com/a.js' },
      { name: 'Plugin2', umdUrl: 'https://example.com/b.js' },
      { esmUrl: 'https://example.com/c.js' },
    ]
    expect(dedupePlugins(plugins)).toHaveLength(3)
  })

  it('prefers session plugins over global plugins (session listed first)', () => {
    const sessionPlugin: PluginDefinition = {
      name: 'SharedPlugin',
      umdUrl: 'https://session.com/plugin.js',
    }
    const globalPlugin: PluginDefinition = {
      name: 'SharedPlugin',
      umdUrl: 'https://global.com/plugin.js',
    }
    const result = dedupePlugins([sessionPlugin, globalPlugin])
    expect(result).toHaveLength(1)
    expect(pluginUrl(result[0]!)).toBe('https://session.com/plugin.js')
  })

  it('handles empty array', () => {
    expect(dedupePlugins([])).toHaveLength(0)
  })

  it('dedupes across different definition types with same URL', () => {
    const plugins: PluginDefinition[] = [
      { esmUrl: 'https://example.com/plugin.js' },
      { esmUrl: 'https://example.com/plugin.js' },
    ]
    expect(dedupePlugins(plugins)).toHaveLength(1)
  })

  it('does not false-dedupe unknown url plugins', () => {
    const plugins = [{} as PluginDefinition, {} as PluginDefinition]
    expect(dedupePlugins(plugins)).toHaveLength(2)
  })
})

describe('PluginLoader.load with allSettled', () => {
  it('skips failed plugins and returns successful ones', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const loader = new PluginLoader(
      [
        { esmUrl: 'https://example.com/good-plugin.js' },
        { esmUrl: 'https://example.com/bad-plugin.js' },
      ],
      {
        fetchESM: async (url: string) => {
          if (url.includes('bad-plugin')) {
            throw new Error('Network error')
          }
          return { default: class FakePlugin {} } as any
        },
      },
    )

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const results = await loader.load()
    expect(results).toHaveLength(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load plugin:',
      expect.any(Error),
    )
    consoleSpy.mockRestore()
  })

  it('returns all plugins when all succeed', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const loader = new PluginLoader(
      [
        { esmUrl: 'https://example.com/plugin1.js' },
        { esmUrl: 'https://example.com/plugin2.js' },
      ],
      {
        fetchESM: async () => ({ default: class FakePlugin {} }) as any,
      },
    )

    const results = await loader.load()
    expect(results).toHaveLength(2)
  })

  it('returns empty array when all plugins fail', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const loader = new PluginLoader(
      [
        { esmUrl: 'https://example.com/plugin1.js' },
        { esmUrl: 'https://example.com/plugin2.js' },
      ],
      {
        fetchESM: async () => {
          throw new Error('All broken')
        },
      },
    )

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const results = await loader.load()
    expect(results).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('returns empty array for empty definitions', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const loader = new PluginLoader([])
    const results = await loader.load()
    expect(results).toHaveLength(0)
  })

  it('skips plugin with no default export', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const loader = new PluginLoader(
      [{ esmUrl: 'https://example.com/no-default.js' }],
      {
        fetchESM: async () => ({}) as any,
      },
    )

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const results = await loader.load()
    expect(results).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('preserves definition on successful load result', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const def: PluginDefinition = {
      esmUrl: 'https://example.com/plugin.js',
    }
    const loader = new PluginLoader([def], {
      fetchESM: async () => ({ default: class FakePlugin {} }) as any,
    })

    const results = await loader.load()
    expect(results).toHaveLength(1)
    expect(results[0]!.definition.esmUrl).toBe('https://example.com/plugin.js')
  })

  it('deep clones definitions so mutations do not affect originals', async () => {
    const PluginLoader = (await import('./PluginLoader.ts')).default
    const original: PluginDefinition = {
      esmUrl: 'https://example.com/plugin.js',
    }
    const loader = new PluginLoader([original])
    // mutating loader's internal copy should not affect original
    loader.definitions[0] = { cjsUrl: 'mutated' }
    expect(original.esmUrl).toBe('https://example.com/plugin.js')
  })
})
