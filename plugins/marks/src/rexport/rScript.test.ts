import { frameFor, helpersFor, locationPath, READERS } from './frameFor.ts'
import { markPlot } from './markToPlot.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { assembleRScript, HELPER_DEPS, resolveHelpers } from './rScript.ts'

describe('the helper closure', () => {
  it('adds a helper its caller never named', () => {
    expect(resolveHelpers(['read_regions'])).toContain('region_layout')
  })

  it('answers a set, not a multiset', () => {
    expect(resolveHelpers(['read_regions', 'read_regions'])).toEqual([
      'read_regions',
      'region_layout',
    ])
  })

  /**
   * The oracle for HELPER_DEPS: a helper body naming another helper needs the
   * edge declared, or a script emits a call to a function it never defined.
   */
  it('declares every helper-to-helper call the R bodies make', () => {
    const names = Object.keys(HELPERS)
    for (const [name, body] of Object.entries(HELPERS)) {
      const called = names.filter(
        other => other !== name && new RegExp(`\\b${other}\\s*\\(`).test(body),
      )
      for (const dep of called) {
        expect([name, HELPER_DEPS[name] ?? []]).toEqual([
          name,
          expect.arrayContaining([dep]),
        ])
      }
    }
  })

  it('names each helper the file it came from defines', () => {
    for (const [name, body] of Object.entries(HELPERS)) {
      expect(body).toMatch(new RegExp(`^${name} <- `, 'm'))
    }
  })
})

describe('a file location becomes a path R opens', () => {
  it('resolves a relative uri against its baseUri', () => {
    expect(
      locationPath({
        uri: 'volvox.bw',
        baseUri: 'https://x.org/data/cfg.json',
      }),
    ).toBe('https://x.org/data/volvox.bw')
  })

  it('hands R a path for a file: uri, not something to fetch', () => {
    expect(locationPath({ uri: 'file:///data/volvox.bw' })).toBe(
      '/data/volvox.bw',
    )
  })

  it('reads the local arm of the union', () => {
    expect(locationPath({ localPath: '/data/volvox.bw' })).toBe(
      '/data/volvox.bw',
    )
  })
})

describe('a frame reads its format', () => {
  it('wraps the reader so only read_regions knows about the axis', () => {
    const f = frameFor({ type: 'BigWigAdapter', uri: '/x/volvox.bw' })
    expect(f.statements).toContain('read_regions(')
    expect(f.statements).toContain(
      'read_bigwig("/x/volvox.bw", chrom, start, end)',
    )
    expect(f.statements).toContain('c("start", "end")')
  })

  it('carries the reader packages onto the script', () => {
    const f = frameFor({ type: 'VcfTabixAdapter', uri: '/x/v.vcf.gz' })
    expect(f.packages).toContain('Rsamtools')
  })

  it('every reader in the table names a helper that exists', () => {
    for (const r of Object.values(READERS)) {
      expect(Object.keys(HELPERS)).toContain(r.helper)
    }
  })
})

describe('the assembled script', () => {
  const script = (regions = [{ refName: 'ctgA', start: 0, end: 1000 }]) => {
    const f = frameFor({ type: 'BigWigAdapter', uri: '/x/volvox.bw' })
    const { plot, notes } = markPlot({
      display: {
        marks: [{ mark: 'bar', encoding: { y: 'score', color: 'steelblue' } }],
      },
      frame: f,
      regions,
    })
    return assembleRScript({
      regions,
      panels: [{ variable: 'p1', plot, helpers: helpersFor('BigWigAdapter') }],
      notes,
    })
  }

  it('carries only the helpers it reached for', () => {
    expect(script()).toContain('read_bigwig <- function')
    expect(script()).not.toContain('read_vcf <- function')
  })

  it('lays the regions out before any panel reads them', () => {
    const r = script()
    expect(r.indexOf('regions <- region_layout')).toBeLessThan(
      r.indexOf('read_regions('),
    )
  })

  it('reaches for patchwork only when the panels stack', () => {
    expect(script()).not.toContain('library(patchwork)')
  })

  it('clamps the figure height ggsave would refuse', () => {
    const f = frameFor({ type: 'BigWigAdapter', uri: '/x/v.bw' })
    const { plot } = markPlot({
      display: { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
      frame: f,
    })
    const r = assembleRScript({
      regions: [{ refName: 'ctgA', start: 0, end: 100 }],
      panels: [{ variable: 'p1', plot, helpers: [], heightWeight: 2504 }],
    })
    expect(r).toContain('height = 50,')
  })

  it('names in the header what it could not draw', () => {
    const f = frameFor({ type: 'BigWigAdapter', uri: '/x/v.bw' })
    const { plot, notes } = markPlot({
      display: {
        marks: [{ mark: 'bar', encoding: { y: 'score', color: 'jexl:x' } }],
      },
      frame: f,
    })
    const r = assembleRScript({
      regions: [{ refName: 'ctgA', start: 0, end: 100 }],
      panels: [{ variable: 'p1', plot, helpers: [] }],
      notes,
    })
    expect(r).toContain('# What this figure does not show:')
    expect(r).toContain('#   - fill: a jexl callback has no R counterpart')
  })
})
