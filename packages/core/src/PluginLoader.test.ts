import { dropVendoredPlugins } from './PluginLoader.ts'

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
