import PluginLoader from './PluginLoader.ts'
import {
  dedupePlugins,
  dropVendoredPlugins,
  isCJSPluginDefinition,
  isESMPluginDefinition,
  isUMDPluginDefinition,
  pluginDefinitionMetadata,
  pluginDescriptionString,
  pluginLabel,
  pluginUrl,
} from './pluginDefinitions.ts'

import type { PluginDefinition } from './pluginDefinitions.ts'

test('drops legacy external plugins now vendored into core', () => {
  const defs: PluginDefinition[] = [
    { name: 'MafViewer', url: 'https://example.com/mafviewer.umd.js' },
    { name: 'SomeOtherPlugin', url: 'https://example.com/other.umd.js' },
  ]
  expect(dropVendoredPlugins(defs)).toEqual([
    { name: 'SomeOtherPlugin', url: 'https://example.com/other.umd.js' },
  ])
})

test('matches the external config name, not the core plugin class name', () => {
  // legacy configs reference "MafViewer"; the core class is now "MafPlugin"
  const defs: PluginDefinition[] = [
    { name: 'MafPlugin', url: 'https://example.com/maf.umd.js' },
  ]
  expect(dropVendoredPlugins(defs)).toEqual(defs)
})

test('leaves ESM/CJS definitions untouched (no name field to match)', () => {
  const defs: PluginDefinition[] = [
    { esmUrl: 'https://example.com/mafviewer.esm.js' },
    { cjsUrl: 'https://example.com/mafviewer.cjs.js' },
  ]
  expect(dropVendoredPlugins(defs)).toEqual(defs)
})

// pluginUrl feeds the trust gate (checkPlugins) and pluginDescriptionString the
// approval prompt; both must name the url loadPlugin will actually run, or the
// gate vets one url and the loader executes another. loadPlugin dispatches
// CJS -> ESM -> UMD, so a mixed definition resolves to its CJS url in both.
test('pluginUrl/description resolve to the url loadPlugin runs, not another', () => {
  const def = {
    name: 'Innocent',
    umdUrl: 'https://jbrowse.org/plugins/innocent.js',
    cjsUrl: 'https://evil.example.com/pwn.js',
  } as unknown as PluginDefinition
  expect(pluginUrl(def)).toBe('https://evil.example.com/pwn.js')
  expect(pluginDescriptionString(def)).toBe(
    'CJS plugin https://evil.example.com/pwn.js',
  )
})

test('loadPlugin refuses a definition that names more than one plugin type', async () => {
  const def = {
    name: 'Innocent',
    umdUrl: 'https://jbrowse.org/plugins/innocent.js',
    cjsUrl: 'https://evil.example.com/pwn.js',
  } as unknown as PluginDefinition
  await expect(new PluginLoader().loadPlugin(def)).rejects.toThrow(
    /more than one plugin type/,
  )
})

// Desktop bundles Blat and Web does not, so the same hub config must be treated
// differently by each: dropping it globally would leave Web with no BLAT at all,
// and not dropping it on Desktop installs the plugin twice.
test('drops a per-product vendored plugin only when that product asks', () => {
  const defs = [
    { name: 'Blat', url: 'https://jbrowse.org/plugins/blat.js' },
    { name: 'MsaView', url: 'https://jbrowse.org/plugins/msa.js' },
  ]
  expect(dropVendoredPlugins(defs)).toEqual(defs)
  expect(dropVendoredPlugins(defs, ['Blat'])).toEqual([defs[1]])
})

// A config names its plugin urls, and nothing revalidates them: a store path
// that stops being republished, or a bundle needing a newer host than the one
// reading the config, both surface here. loadSettled keeps the plugins that did
// load so the app can open without the ones that didn't.
test('loadSettled separates loaded plugins from failures', async () => {
  const good = { esmUrl: 'https://example.com/good.esm.js' }
  const bad = { esmUrl: 'https://example.com/bad.esm.js' }
  const loader = new PluginLoader([good, bad], {
    fetchESM: url =>
      url.includes('good')
        ? Promise.resolve({ default: class Good {} as never })
        : Promise.reject(new Error('404 not found')),
  })
  const { records, failures } = await loader.loadSettled()
  expect(records.map(r => r.definition)).toEqual([good])
  expect(failures.map(f => f.definition)).toEqual([bad])
  expect(`${failures[0]!.error}`).toMatch(/404 not found/)
})

// load() stays all-or-nothing for callers that cannot degrade (the RPC worker),
// and rethrows by definition order so which error surfaces doesn't depend on
// which request happened to fail first.
test('load rethrows the first failure by definition order', async () => {
  const loader = new PluginLoader(
    [
      { esmUrl: 'https://example.com/first.esm.js' },
      { esmUrl: 'https://example.com/second.esm.js' },
    ],
    {
      fetchESM: url =>
        Promise.reject(
          new Error(url.includes('first') ? 'first failed' : 'second failed'),
        ),
    },
  )
  await expect(loader.load()).rejects.toThrow(/first failed/)
})

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
