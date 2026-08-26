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
import { stringToJexlExpression } from './util/jexlStrings.ts'
import SimpleFeature from './util/simpleFeature.ts'

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

// A plugin url resolves against the JBrowse instance, never against the config
// that named it — so a config saying `url: 'plugin.js'` means something
// different on every host that reads it, and on Desktop means nothing at all.
// Both halves of that are worth pinning, because the rule is invisible from the
// config side and the two failures read very differently.
describe('a relative plugin url', () => {
  const relative = { name: 'Hub', url: 'plugin.js' }

  test('resolves against the instance, not the config that named it', async () => {
    const loaded: string[] = []
    await new PluginLoader([{ esmUrl: 'plugin.esm.js' }], {
      fetchESM: url => {
        loaded.push(url)
        return Promise.resolve({ default: class P {} as never })
      },
    }).load('https://jbrowse.org/code/jb2/main/')

    expect(loaded[0]).toBe('https://jbrowse.org/code/jb2/main/plugin.esm.js')
  })

  test('explains itself when the instance is a file:// page (desktop)', async () => {
    const { failures } = await new PluginLoader([relative]).loadSettled(
      'file:///opt/JBrowse/resources/app/index.html',
    )

    // the old message named only the scheme of a url the config author never
    // wrote, which on a third-party hub config is undiagnosable
    expect(`${failures[0]!.error}`).toMatch(
      /relative url "plugin\.js".*resolves against this JBrowse instance.*umdLoc\/esmLoc/s,
    )
  })

  test('is not what a bad scheme reports', async () => {
    const { failures } = await new PluginLoader([
      { name: 'Odd', url: 'ftp://example.com/plugin.js' },
    ]).loadSettled('https://jbrowse.org/')

    expect(`${failures[0]!.error}`).toMatch(/protocol "ftp:"/)
  })

  // the config-relative channel, and the only form that survives being read by a
  // host somewhere else: addRelativeUris stamps this baseUri from the config url,
  // so it ignores the instance entirely — including a file:// one
  test('the esmLoc form resolves against the config instead', async () => {
    const loaded: string[] = []
    await new PluginLoader(
      [
        {
          name: 'Hub',
          esmLoc: {
            uri: 'plugin.js',
            baseUri: 'https://hub.example.org/cfg/config.json',
          },
        },
      ],
      {
        fetchESM: url => {
          loaded.push(url)
          return Promise.resolve({ default: class P {} as never })
        },
      },
    ).load('file:///opt/JBrowse/resources/app/index.html')

    expect(loaded[0]).toBe('https://hub.example.org/cfg/plugin.js')
  })
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

  // a ref carries no url until the manifest supplies one, and often no name
  // either — labelling it 'unknown url' is a marker that names nothing
  it('names an unresolved store ref by the entry it asks for', () => {
    expect(pluginLabel({ storePlugin: 'GWAS' })).toBe('GWAS')
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

// The runtime ABI moved behind a dynamic import so that a host loading no
// runtime plugin doesn't pay for it (~126 KB gzipped, see
// ReExports/registry.ts). That makes *when* it is published a contract rather
// than a consequence of a static import, and these are its two halves: a UMD
// bundle reads `JBrowseExports` off the global at module scope, and a CJS/ESM
// plugin's `install()` calls `pluginManager.jbrequire(name)` synchronously.
// Both must be satisfied by the time any plugin script runs.
describe('runtime re-export ABI', () => {
  it('publishes JBrowseExports on the target before loading plugins', async () => {
    const target = {} as WindowOrWorkerGlobalScope & { JBrowseExports?: object }
    await new PluginLoader([]).installGlobalReExports(target).load()
    expect(target.JBrowseExports).toBeDefined()
    // one entry from each of the two barrel shapes the registry serves
    expect(target.JBrowseExports).toHaveProperty('@jbrowse/core/util')
    expect(target.JBrowseExports).toHaveProperty('react')
  })

  // in its own module registry, so the assertion is that *this* load populated
  // it — the registry is module-level state, and reusing the one an earlier
  // test filled would let this pass with the wiring removed
  it('makes the synchronous jbrequire path resolve once a load has run', async () => {
    jest.resetModules()
    const { default: Loader } = await import('./PluginLoader.ts')
    const { default: Manager } = await import('./PluginManager.ts')
    // matched through the path it names, not just the prefix: the message is
    // the one actionable thing a no-build plugin author gets, the imports guide
    // quotes it verbatim, and it spent a while pointing at `ReExports.js` — a
    // file that stopped existing when the list moved to `ReExports/list.ts`
    expect(() => new Manager([]).jbrequire('@jbrowse/core/util')).toThrow(
      /No jbrequire re-export defined .* add it to ReExports\/list\.ts/,
    )
    await new Loader([])
      .installGlobalReExports({} as WindowOrWorkerGlobalScope)
      .load()
    expect(new Manager([]).jbrequire('@jbrowse/core/util')).toHaveProperty(
      'getSession',
    )
  })

  it('leaves the target alone until a load actually happens', () => {
    const target = {} as WindowOrWorkerGlobalScope & { JBrowseExports?: object }
    new PluginLoader([]).installGlobalReExports(target)
    expect(target.JBrowseExports).toBeUndefined()
  })
})

// End-to-end over the real fixture the no-build-plugin guide is generated from
// (test_data/no_build_plugin/esmplugin.js): its `install()` calls `jbrequire`
// five times at the top, so this fails outright if the registry is not
// published by the time a plugin runs. That is the half of the ABI a unit test
// on the loader alone cannot see, and the reason the registry's dynamic import
// lives in `loadSettled` rather than anywhere later.
test('a real no-build plugin installs through jbrequire', async () => {
  jest.resetModules()
  const { default: Loader } = await import('./PluginLoader.ts')
  const { default: Manager } = await import('./PluginManager.ts')
  const records = await new Loader(
    [{ esmUrl: 'https://example.com/esmplugin.js' }],
    {
      fetchESM: () => import('../../../test_data/no_build_plugin/esmplugin.js'),
    },
  )
    .installGlobalReExports({} as WindowOrWorkerGlobalScope)
    .load()
  // the shape every product builds: the loader returns the class, the manager
  // takes an instance (createPluginManager.ts's asPluginRecord)
  const pluginManager = new Manager(
    records.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
    })),
  ).createPluggableElements()
  pluginManager.configure()
  expect(pluginManager.getWidgetType('CiteWidget').heading).toBe(
    'Cite this JBrowse session',
  )
  // the guide's other half: a jexl function registered from the same install()
  // is what a config callback resolves against, and jbrequire is not involved
  // in that path at all — `pluginManager.jexl` is handed to the plugin directly
  const color = await stringToJexlExpression(
    'jexl:customColor(feature)',
    pluginManager.jexl,
  ).eval({
    feature: new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 0,
      end: 10,
      type: 'CDS',
    }),
  })
  expect(color).toBe('green')
})
