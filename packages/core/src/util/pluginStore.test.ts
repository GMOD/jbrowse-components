import {
  getPluginUpdate,
  installablePlugins,
  installedVersionFromUrl,
  resolvePlugin,
  resolveStorePluginRefs,
  resolveStoreRefs,
} from './pluginStore.ts'

import type { JBrowsePlugin } from './types/data.ts'

function plugin(extra: Partial<JBrowsePlugin>): JBrowsePlugin {
  return {
    name: 'Test',
    authors: [],
    description: '',
    location: '',
    license: '',
    ...extra,
  }
}

const versioned = plugin({
  url: 'https://x/3.0.0/p.js',
  integrity: 'sha384-latest',
  versions: [
    {
      pluginVersion: '1.4.0',
      jbrowseRange: '>=2.0.0 <3.0.0',
      url: 'https://x/1.4.0/p.js',
      integrity: 'sha384-old',
    },
    {
      pluginVersion: '3.0.0',
      jbrowseRange: '>=3.0.0',
      url: 'https://x/3.0.0/p.js',
      integrity: 'sha384-new',
    },
  ],
})

describe('resolvePlugin', () => {
  it('picks the version matching the running JBrowse', () => {
    const r = resolvePlugin(versioned, '2.5.0')
    expect(r.compatible).toBe(true)
    expect(r.pluginVersion).toBe('1.4.0')
    expect(r.definition).toEqual({
      name: 'Test',
      url: 'https://x/1.4.0/p.js',
      integrity: 'sha384-old',
    })
  })

  it('picks the newest matching version when several match', () => {
    const r = resolvePlugin(versioned, '4.3.0')
    expect(r.pluginVersion).toBe('3.0.0')
    expect(r.definition).toEqual({
      name: 'Test',
      url: 'https://x/3.0.0/p.js',
      integrity: 'sha384-new',
    })
  })

  it('marks incompatible when no version supports the running JBrowse', () => {
    const r = resolvePlugin(versioned, '1.0.0')
    expect(r.compatible).toBe(false)
    expect(r.supportedRanges).toEqual(['>=2.0.0 <3.0.0', '>=3.0.0'])
  })

  // 5.0.0-beta.1 sorts below 5.0.0 under semver, so a range meant to keep a
  // plugin off v5 served it to every beta host, and a v5-only range hid it
  it('matches a prerelease host as its release', () => {
    const keptOffV5 = plugin({
      versions: [
        {
          pluginVersion: '1.0.0',
          jbrowseRange: '<5.0.0',
          url: 'https://x/1.0.0/p.js',
        },
      ],
    })
    expect(resolvePlugin(keptOffV5, '5.0.0-beta.1').compatible).toBe(false)
    expect(resolvePlugin(keptOffV5, '4.9.9').compatible).toBe(true)
    const v5Only = plugin({
      versions: [
        {
          pluginVersion: '2.0.0',
          jbrowseRange: '^5.0.0',
          url: 'https://x/2.0.0/p.js',
        },
      ],
    })
    expect(resolvePlugin(v5Only, '5.0.0-beta.1').compatible).toBe(true)
    expect(resolvePlugin(v5Only, '5.0.0-beta.1').pluginVersion).toBe('2.0.0')
  })

  it('treats * as matching any JBrowse version', () => {
    const p = plugin({
      url: 'https://x/latest/p.js',
      versions: [
        {
          pluginVersion: '2.0.0',
          jbrowseRange: '*',
          url: 'https://x/2.0.0/p.js',
        },
      ],
    })
    const r = resolvePlugin(p, '4.3.0')
    expect(r.compatible).toBe(true)
    expect(r.pluginVersion).toBe('2.0.0')
  })

  // resolvePlugin used to throw here, taking out the whole store list rather
  // than rendering this one entry as incompatible
  it('resolves without a definition when only per-version urls exist and none match', () => {
    const p = plugin({
      versions: [
        {
          pluginVersion: '2.0.0',
          jbrowseRange: '>=2.0.0 <3.0.0',
          url: 'https://x/2.0.0/p.js',
        },
      ],
    })
    const r = resolvePlugin(p, '4.3.0')
    expect(r.compatible).toBe(false)
    expect(r.definition).toBeUndefined()
    expect(r.supportedRanges).toEqual(['>=2.0.0 <3.0.0'])
  })

  it('resolves without a definition for an entry carrying no url at all', () => {
    const r = resolvePlugin(plugin({}), '4.3.0')
    expect(r.compatible).toBe(true)
    expect(r.definition).toBeUndefined()
  })

  it('falls back to top-level url when no versions are declared', () => {
    const p = plugin({ url: 'https://x/p.js', integrity: 'sha384-z' })
    const r = resolvePlugin(p, '4.3.0')
    expect(r.compatible).toBe(true)
    expect(r.pluginVersion).toBeUndefined()
    expect(r.definition).toEqual({
      name: 'Test',
      url: 'https://x/p.js',
      integrity: 'sha384-z',
    })
  })
})

// The two store surfaces share this, so what one offers is what the other's
// loader will accept. Every miss here is silent: an entry that vanishes with no
// diagnostic, or one that installs and does nothing.
describe('installablePlugins', () => {
  const names = (plugins: JBrowsePlugin[], isElectron: boolean) =>
    installablePlugins(plugins, isElectron).map(p => p.name)

  it('keeps an entry whose only web build is per-version', () => {
    // resolvePlugin installs from versions[] and treats the top-level url as the
    // fallback, so an entry published this way is a shape it expects — the filter
    // used to read only the top level and drop it from web's list entirely
    const p = plugin({
      name: 'PerVersion',
      versions: [
        {
          pluginVersion: '1.0.0',
          jbrowseRange: '*',
          esmUrl: 'https://x/1.0.0/p.js',
        },
      ],
    })
    expect(names([p], false)).toEqual(['PerVersion'])
  })

  it('drops an entry with no web build anywhere, and keeps it on desktop', () => {
    const p = plugin({
      name: 'CjsOnly',
      cjsUrl: 'https://x/p.cjs',
      versions: [
        {
          pluginVersion: '1.0.0',
          jbrowseRange: '*',
          cjsUrl: 'https://x/1.0.0/p.cjs',
        },
      ],
    })
    expect(names([p], false)).toEqual([])
    expect(names([p], true)).toEqual(['CjsOnly'])
  })

  it('drops the plugins both products vendor', () => {
    const shared = [plugin({ name: 'MafViewer' }), plugin({ name: 'GWAS' })]
    expect(names(shared, false)).toEqual([])
    expect(names(shared, true)).toEqual([])
  })

  // the half that was missing from both surfaces: desktop bundles Blat, so
  // installing it there writes an entry dropVendoredPlugins then drops at load
  it('drops Blat on desktop only, since web has to load it to have BLAT', () => {
    const blat = [plugin({ name: 'Blat', umdUrl: 'https://x/blat.js' })]
    expect(names(blat, true)).toEqual([])
    expect(names(blat, false)).toEqual(['Blat'])
  })
})

describe('installedVersionFromUrl', () => {
  const pkg = 'jbrowse-plugin-msaview'
  const url = `https://jbrowse.org/plugins/${pkg}/2.5.0/dist/x.umd.min.js`

  it('reads the version segment after the package name', () => {
    expect(installedVersionFromUrl(url, pkg)).toBe('2.5.0')
  })

  it('handles scoped package names', () => {
    const u = 'https://jbrowse.org/plugins/@org/p/1.2.3/dist/x.js'
    expect(installedVersionFromUrl(u, '@org/p')).toBe('1.2.3')
  })

  it('returns undefined for a custom url without the package name', () => {
    expect(installedVersionFromUrl('https://other/x.js', pkg)).toBeUndefined()
  })

  it('returns undefined when url or packageName is missing', () => {
    expect(installedVersionFromUrl(undefined, pkg)).toBeUndefined()
    expect(installedVersionFromUrl(url, undefined)).toBeUndefined()
  })

  it('reads the raw segment after the package name for a pre-versioning url', () => {
    // legacy layout has the umd path, not a version, after the package name; the
    // extracted 'dist' segment is harmless because it fails to compare as a
    // semver version downstream (getPluginUpdate), so no update is ever offered
    const u = `https://jbrowse.org/plugins/${pkg}/dist/x.umd.min.js`
    expect(installedVersionFromUrl(u, pkg)).toBe('dist')
  })
})

describe('getPluginUpdate', () => {
  it('offers the newest compatible version when newer than installed', () => {
    const u = getPluginUpdate(versioned, '4.3.0', '1.4.0')
    expect(u?.pluginVersion).toBe('3.0.0')
    expect(u?.definition).toEqual({
      name: 'Test',
      url: 'https://x/3.0.0/p.js',
      integrity: 'sha384-new',
    })
  })

  it('offers nothing when already on the newest compatible version', () => {
    expect(getPluginUpdate(versioned, '4.3.0', '3.0.0')).toBeUndefined()
  })

  it('does not offer a version incompatible with the running JBrowse', () => {
    // installed 1.4.0 on JBrowse 2.5.0; 3.0.0 needs JBrowse >=3 so no update
    expect(getPluginUpdate(versioned, '2.5.0', '1.4.0')).toBeUndefined()
  })

  it('offers nothing when the installed version is unknown', () => {
    expect(getPluginUpdate(versioned, '4.3.0', undefined)).toBeUndefined()
  })

  it('offers nothing for an entry without resolvable versions', () => {
    const p = plugin({ url: 'https://x/p.js' })
    expect(getPluginUpdate(p, '4.3.0', '1.0.0')).toBeUndefined()
  })

  it('tolerates an unparsable installed version', () => {
    expect(getPluginUpdate(versioned, '4.3.0', 'garbage')).toBeUndefined()
  })
})

// The store entry a config's ref points at, in the shape jbrowse-plugin-list
// actually publishes: a version-pinned url with an integrity hash, keyed by the
// store's `name`. A ref names that, never `packageName` — see ADR 0008 and the
// test below that pins it.
const store = [
  plugin({
    name: 'MsaView',
    packageName: 'jbrowse-plugin-msaview',
    url: 'https://jbrowse.org/plugins/jbrowse-plugin-msaview/3.3.0/dist/m.js',
    integrity: 'sha384-msa',
    versions: [
      {
        pluginVersion: '3.3.0',
        jbrowseRange: '*',
        url: 'https://jbrowse.org/plugins/jbrowse-plugin-msaview/3.3.0/dist/m.js',
        integrity: 'sha384-msa',
      },
    ],
  }),
]

const resolvedMsaView = {
  name: 'MsaView',
  url: 'https://jbrowse.org/plugins/jbrowse-plugin-msaview/3.3.0/dist/m.js',
  integrity: 'sha384-msa',
  storePlugin: 'MsaView',
}

describe('resolveStoreRefs', () => {
  it('turns a ref into the pinned, integrity-carrying definition', () => {
    const { definitions, failures } = resolveStoreRefs(
      [{ storePlugin: 'MsaView' }],
      store,
      '4.3.0',
    )
    expect(failures).toEqual([])
    expect(definitions).toEqual([resolvedMsaView])
  })

  // the name is what dropVendoredPlugins and PluginLoader's UMD global lookup
  // both read, and taking it from the store rather than from the config is what
  // keeps the two from drifting apart
  it('takes the UMD name from the store, not from the config', () => {
    const { definitions } = resolveStoreRefs(
      [{ storePlugin: 'MsaView', name: 'WhateverTheConfigSaid' }],
      store,
      '4.3.0',
    )
    expect(definitions[0]).toEqual(resolvedMsaView)
  })

  // The whole point of ADR 0008's key choice. npm owns the package name and can
  // rename it; the store owns `name`. A ref that resolved against packageName
  // would strand every config naming a plugin that moved scope — the mistake
  // naming a url makes, one level up. So the package name is NOT a ref.
  it('does not resolve a ref that names the npm package', () => {
    const { definitions, failures } = resolveStoreRefs(
      [{ storePlugin: 'jbrowse-plugin-msaview' }],
      store,
      '4.3.0',
    )
    expect(definitions).toEqual([])
    expect(`${failures[0]!.error}`).toMatch(/not in the plugin store/)
  })

  it('leaves a definition that is not a ref alone', () => {
    const defs = [
      { name: 'Other', url: 'https://example.com/o.js' },
      { esmUrl: 'https://example.com/e.js' },
    ]
    expect(resolveStoreRefs(defs, store, '4.3.0').definitions).toEqual(defs)
  })

  // the migration shape: the ref for a JBrowse that resolves it, the `latest/`
  // url for one that does not. An unreadable store is exactly the case where the
  // url is no worse than not having tried.
  it.each([
    ['the store cannot be read', undefined],
    ['the name is not listed', store],
  ])('falls back to the url it carries when %s', (_why, listing) => {
    const warned = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const hybrid = {
      name: 'Retired',
      url: 'https://jbrowse.org/plugins/jbrowse-plugin-retired/latest/dist/r.js',
      storePlugin: 'Retired',
    }
    const { definitions, failures } = resolveStoreRefs(
      [hybrid],
      listing,
      '4.3.0',
    )
    expect(failures).toEqual([])
    expect(definitions).toEqual([hybrid])
    // the fallback is silent to the config but not to the console, and naming
    // the url is what makes the warning actionable
    expect(`${warned.mock.calls[0]?.[0]}`).toContain(hybrid.url)
    warned.mockRestore()
  })

  it('fails a ref with no url to fall back on', () => {
    const { definitions, failures } = resolveStoreRefs(
      [{ storePlugin: 'Retired' }],
      store,
      '4.3.0',
    )
    expect(definitions).toEqual([])
    expect(failures).toHaveLength(1)
    expect(`${failures[0]!.error}`).toMatch(/not in the plugin store/)
  })

  // ADR 0007's hole, in test form: a range that excludes this host is the store
  // saying the bundle does not work here, so the fallback url must NOT run.
  // Falling back would hide the plugin from clients that read ranges and leave
  // it armed for everyone else.
  it('refuses the fallback when the store has no build for this JBrowse', () => {
    const listing = [
      plugin({
        name: 'Old',
        packageName: 'jbrowse-plugin-old',
        url: 'https://jbrowse.org/plugins/jbrowse-plugin-old/1.0.0/dist/o.js',
        versions: [
          {
            pluginVersion: '1.0.0',
            jbrowseRange: '<2.0.0',
            url: 'https://jbrowse.org/plugins/jbrowse-plugin-old/1.0.0/dist/o.js',
          },
        ],
      }),
    ]
    const { definitions, failures } = resolveStoreRefs(
      [
        {
          name: 'Old',
          url: 'https://jbrowse.org/plugins/jbrowse-plugin-old/latest/dist/o.js',
          storePlugin: 'Old',
        },
      ],
      listing,
      '4.3.0',
    )
    expect(definitions).toEqual([])
    expect(`${failures[0]!.error}`).toMatch(/no build .* for JBrowse 4\.3\.0/)
    expect(`${failures[0]!.error}`).toMatch(/<2\.0\.0/)
  })
})

describe('resolveStorePluginRefs', () => {
  it('does not touch the network when nothing is a ref', async () => {
    const fetchStore = jest.fn()
    const defs = [{ name: 'Other', url: 'https://example.com/o.js' }]
    const { definitions } = await resolveStorePluginRefs(
      defs,
      '4.3.0',
      fetchStore,
    )
    expect(fetchStore).not.toHaveBeenCalled()
    expect(definitions).toEqual(defs)
  })

  // the store being down must not be able to take out a config that also names
  // a url, which is every config the migration shape produces
  it('resolves against an unreadable store as if nothing were listed', async () => {
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    const warned = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const hybrid = {
      name: 'MsaView',
      url: 'https://jbrowse.org/plugins/jbrowse-plugin-msaview/latest/dist/m.js',
      storePlugin: 'MsaView',
    }
    const { definitions, failures } = await resolveStorePluginRefs(
      [hybrid],
      '4.3.0',
      () => Promise.reject(new Error('offline')),
    )
    expect(failures).toEqual([])
    expect(definitions).toEqual([hybrid])
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('offline')
    expect(`${warned.mock.calls[0]?.[0]}`).toContain(hybrid.url)
    reported.mockRestore()
    warned.mockRestore()
  })

  it('fetches once and resolves against what it got', async () => {
    const { definitions } = await resolveStorePluginRefs(
      [{ storePlugin: 'MsaView' }],
      '4.3.0',
      () => Promise.resolve({ plugins: store }),
    )
    expect(definitions).toEqual([resolvedMsaView])
  })
})
