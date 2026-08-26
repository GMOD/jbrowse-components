import {
  dedupePlugins,
  dropVendoredPlugins,
  isPluginUrl,
  maybePluginUrl,
  pluginDescriptionString,
  pluginUrl,
  pluginsNotIn,
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

// The same 'unknown url' trap on the other side: keying trust and removal off
// pluginUrl made one url-less definition stand for all of them, and made a
// missing install url (a core or global plugin, which recorded none) match the
// first url-less entry in a list.
describe('isPluginUrl', () => {
  const url = 'https://example.com/a.js'

  it('matches the definition loading from that url', () => {
    expect(isPluginUrl({ esmUrl: url }, url)).toBe(true)
    expect(isPluginUrl({ esmUrl: 'https://example.com/b.js' }, url)).toBe(false)
  })

  it('matches nothing when the definition names no loader', () => {
    const empty = {} as PluginDefinition
    expect(isPluginUrl(empty, 'unknown url')).toBe(false)
    expect(isPluginUrl(empty, undefined)).toBe(false)
  })

  it('matches nothing when no url was recorded', () => {
    expect(isPluginUrl({ esmUrl: url }, undefined)).toBe(false)
  })
})

describe('pluginsNotIn', () => {
  const a: PluginDefinition = { name: 'A', umdUrl: 'https://x/a.js' }

  it('drops candidates an existing definition already describes', () => {
    // by name, so a different pinned version of the same plugin counts as
    // present — which is what PluginManager.addPlugin enforces at load
    expect(
      pluginsNotIn([{ name: 'A', umdUrl: 'https://x/a-2.0.js' }], [a]),
    ).toEqual([])
  })

  it('keeps candidates nothing existing describes', () => {
    const b: PluginDefinition = { name: 'B', umdUrl: 'https://x/b.js' }
    expect(pluginsNotIn([b], [a])).toEqual([b])
    expect(pluginsNotIn([b], [])).toEqual([b])
  })
})

// A store ref and the definition it resolves to share no url and, until the
// manifest supplies one, no name. The package is the only key that spans them,
// and every "do I already have this" answer runs through samePlugin.
describe('store refs', () => {
  const ref: PluginDefinition = { storePlugin: 'jbrowse-plugin-msaview' }
  const resolved: PluginDefinition = {
    name: 'MsaView',
    url: 'https://jbrowse.org/plugins/jbrowse-plugin-msaview/3.3.0/dist/m.js',
    storePlugin: 'jbrowse-plugin-msaview',
  }

  it('matches a ref against what it resolved to', () => {
    expect(samePlugin(ref, resolved)).toBe(true)
  })

  it('does not match two refs to different packages', () => {
    expect(samePlugin(ref, { storePlugin: 'jbrowse-plugin-protein3d' })).toBe(
      false,
    )
  })

  // "unknown plugin from unknown url" is what an unresolved ref used to report
  // itself as, which is the text a resolution failure is shown on
  it('describes itself by package when it has no url yet', () => {
    expect(pluginDescriptionString(ref)).toBe(
      'store plugin jbrowse-plugin-msaview',
    )
  })

  // dropVendoredPlugins matches on the UMD name, which a ref does not carry —
  // so a config naming a vendored plugin by package only gets dropped once
  // resolution has supplied the name. Ordering, not a filter change, is the fix;
  // this pins both halves.
  it('is dropped as vendored only after resolution supplies the name', () => {
    expect(
      dropVendoredPlugins([{ storePlugin: 'jbrowse-plugin-mafviewer' }]),
    ).toHaveLength(1)
    expect(
      dropVendoredPlugins([
        {
          name: 'MafViewer',
          url: 'https://jbrowse.org/plugins/jbrowse-plugin-mafviewer/1.0.0/dist/m.js',
          storePlugin: 'jbrowse-plugin-mafviewer',
        },
      ]),
    ).toEqual([])
  })
})
