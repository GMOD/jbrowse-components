import PluginLoader, {
  dropVendoredPlugins,
  pluginDescriptionString,
  pluginUrl,
} from './PluginLoader.ts'

import type { PluginDefinition } from './PluginLoader.ts'

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
