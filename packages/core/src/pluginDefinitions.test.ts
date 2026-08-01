import {
  dedupePlugins,
  maybePluginUrl,
  pluginUrl,
  samePlugin,
} from './pluginDefinitions.ts'

import type { PluginDefinition } from './pluginDefinitions.ts'

// samePlugin is the one answer to "is this the plugin I already have", used by
// dedupePlugins when merging plugin sources and by the plugin store's
// installed-check. A false positive silently drops a plugin the user asked for;
// a false negative installs a second copy of one already loaded, which fails
// with duplicate pluggable-element registrations.
describe('samePlugin', () => {
  const umd: PluginDefinition = {
    name: 'MyPlugin',
    umdUrl: 'https://example.com/a.js',
  }

  it('matches on name across definition kinds', () => {
    expect(
      samePlugin(umd, { name: 'MyPlugin', esmUrl: 'https://x/b.js' }),
    ).toBe(true)
  })

  it('matches on url when neither carries a name', () => {
    const a = { esmUrl: 'https://example.com/p.js' }
    expect(samePlugin(a, { esmUrl: 'https://example.com/p.js' })).toBe(true)
    expect(samePlugin(a, { esmUrl: 'https://example.com/q.js' })).toBe(false)
  })

  it('does not match two definitions that merely both lack a name', () => {
    expect(
      samePlugin(
        { esmUrl: 'https://example.com/a.js' },
        { esmUrl: 'https://example.com/b.js' },
      ),
    ).toBe(false)
  })

  // pluginUrl's 'unknown url' is display text; comparing on it would make every
  // definition naming no loader the same plugin as every other
  it('does not match two definitions that name no loader', () => {
    const empty = {} as PluginDefinition
    expect(maybePluginUrl(empty)).toBeUndefined()
    expect(pluginUrl(empty)).toBe('unknown url')
    expect(samePlugin(empty, {} as PluginDefinition)).toBe(false)
    expect(dedupePlugins([empty, {} as PluginDefinition])).toHaveLength(2)
  })
})
