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
