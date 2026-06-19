import { resolvePlugin } from './pluginStore.ts'

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
