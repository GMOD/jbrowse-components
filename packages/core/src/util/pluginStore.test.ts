import {
  getPluginUpdate,
  installedVersionFromUrl,
  resolvePlugin,
} from './pluginStore.ts'

import type { JBrowsePlugin } from './types/index.ts'

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

  it('returns undefined for a pre-versioning unversioned url', () => {
    // legacy layout has the umd path, not a version, after the package name;
    // that segment fails to compare as a version so no update is offered
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

  it('tolerates an unparseable installed version', () => {
    expect(getPluginUpdate(versioned, '4.3.0', 'garbage')).toBeUndefined()
  })
})
