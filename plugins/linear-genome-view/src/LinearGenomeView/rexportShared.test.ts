import { firstUri, rName, rStr, safeVarName } from './rexportShared.ts'

describe('firstUri', () => {
  it('takes the first non-empty candidate', () => {
    expect(firstUri(undefined, '', 'b.bw', 'c.bw')).toBe('b.bw')
    expect(firstUri()).toBe('')
  })

  // The whole reason firstUri takes a location and not a `.uri`: a local-file
  // track spells its source as `localPath`, and reading only `.uri` emitted
  // `path <- ""`. That is jbrowse-desktop's normal case and every file
  // `jb2export --out fig.R` is pointed at from disk, and it failed in R — as an
  // unreadable empty path — rather than here.
  it('reads localPath as well as uri', () => {
    expect(firstUri({ localPath: '/data/reads.bam' })).toBe('/data/reads.bam')
    expect(firstUri({ uri: 'https://x/reads.bam' })).toBe('https://x/reads.bam')
  })

  // A config loaded from a url addresses its data relative to itself, and
  // addRelativeUris stamps the base alongside. Emitting the raw uri put a bare
  // filename in the script, which R cannot open.
  it('resolves a relative uri against its baseUri', () => {
    expect(
      firstUri({
        uri: 'volvox.test.vcf.gz',
        baseUri: 'https://jbrowse.org/code/jb2/test_data/volvox/config.json',
      }),
    ).toBe('https://jbrowse.org/code/jb2/test_data/volvox/volvox.test.vcf.gz')
  })

  it('leaves an absolute uri alone even with a baseUri', () => {
    expect(
      firstUri({
        uri: 'https://example.com/x.bw',
        baseUri: 'https://jbrowse.org/config.json',
      }),
    ).toBe('https://example.com/x.bw')
  })

  // Desktop's normal case: a config.json opened from disk stamps its own
  // directory as the baseUri, so every relative track uri resolves to a `file:`
  // URL. Rsamtools/rtracklayer open a path, not a URL, so emitting the URL is a
  // script that fails on every track — and only for desktop users.
  it('a file: uri becomes the path R opens', () => {
    expect(
      firstUri({ uri: 'reads.bam', baseUri: 'file:///data/proj/config.json' }),
    ).toBe('/data/proj/reads.bam')
    expect(firstUri({ uri: 'file:///data/x%20y/reads.bam' })).toBe(
      '/data/x y/reads.bam',
    )
  })

  it('skips a location that carries neither', () => {
    expect(firstUri({}, { localPath: '/data/b.bw' })).toBe('/data/b.bw')
    expect(firstUri(undefined, { uri: '' }, 'fallback.bw')).toBe('fallback.bw')
  })

  it('mixes bare strings and locations in one fallback chain', () => {
    expect(firstUri({ localPath: '/a.vcf.gz' }, 'shorthand.vcf.gz')).toBe(
      '/a.vcf.gz',
    )
    expect(firstUri({}, undefined, 'shorthand.vcf.gz')).toBe('shorthand.vcf.gz')
  })
})

describe('rStr', () => {
  it('escapes backslashes and quotes', () => {
    expect(rStr('a"b')).toBe('"a\\"b"')
    expect(rStr('C:\\data\\x.bw')).toBe('"C:\\\\data\\\\x.bw"')
  })
})

describe('safeVarName', () => {
  it('replaces non-alphanumerics', () => {
    expect(safeVarName('volvox_microarray.bw')).toBe('volvox_microarray_bw')
  })

  // R accepts neither a digit nor an underscore as the first character of an
  // identifier, so the obvious `_`-prefix guard emits a script that fails to
  // PARSE — every track whose id starts with a digit (1000g_…, 1KGP_…) took the
  // whole figure down with `unexpected numeric constant`.
  it('makes a leading digit or underscore a legal R identifier', () => {
    for (const name of ['1000g', '1KGP_3202', '_leading']) {
      const v = safeVarName(name)
      expect(v).toMatch(/^[a-zA-Z]/)
    }
    expect(safeVarName('1000g')).toBe('x1000g')
    expect(safeVarName('_leading')).toBe('x_leading')
  })
})

describe('rName', () => {
  it('backtick-quotes and strips stray backticks', () => {
    expect(rName('chr 1')).toBe('`chr 1`')
    expect(rName('a`b')).toBe('`ab`')
  })
})
