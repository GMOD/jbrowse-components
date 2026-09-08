import {
  getDescriptionHtmlUrl,
  rebaseDescriptionHtml,
} from './descriptionHtml.ts'

const base =
  'https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.4/html/GCF_000001735.4_TAIR10.1.repeatMasker'

describe('getDescriptionHtmlUrl', () => {
  // the shape UCSCTrackHubConnection writes
  it('reads the anchor at metadata.html', () => {
    expect(
      getDescriptionHtmlUrl({
        metadata: { html: `<a href="${base}">html/x.repeatMasker</a>` },
      }),
    ).toBe(base)
  })

  // the shape the bulk converter behind genomes.jbrowse.org writes, which is
  // baked into ~50,700 configs at permanent URLs
  it('reads the anchor at metadata.ucsc.html', () => {
    expect(
      getDescriptionHtmlUrl({
        metadata: {
          ucsc: { track: 'repeatMasker', html: `<a href='${base}'>x</a>` },
        },
      }),
    ).toBe(base)
  })

  // an assembly's reference sequence track spells the same thing htmlPath
  it('reads htmlPath, nested and not', () => {
    expect(
      getDescriptionHtmlUrl({
        metadata: { htmlPath: `<a href="${base}">x</a>` },
      }),
    ).toBe(base)
    expect(
      getDescriptionHtmlUrl({
        metadata: { ucsc: { htmlPath: `<a href="${base}">x</a>` } },
      }),
    ).toBe(base)
  })

  // htmlLink escapes the url it puts in the anchor, so a regex over the markup
  // would hand back the entities
  it('decodes entities in the href', () => {
    expect(
      getDescriptionHtmlUrl({
        metadata: { html: `<a href="${base}?a=1&amp;b=2">x</a>` },
      }),
    ).toBe(`${base}?a=1&b=2`)
  })

  it('accepts a bare url', () => {
    expect(getDescriptionHtmlUrl({ metadata: { html: base } })).toBe(base)
  })

  it('is undefined for a track with no description page', () => {
    expect(
      getDescriptionHtmlUrl({ metadata: { ucsc: { track: 'gc5Base' } } }),
    ).toBeUndefined()
    expect(getDescriptionHtmlUrl({ metadata: {} })).toBeUndefined()
    expect(getDescriptionHtmlUrl({})).toBeUndefined()
  })

  // a relative path that never got resolved is not something to fetch against
  // the JBrowse origin
  it('is undefined for a value that is neither an anchor nor an absolute url', () => {
    expect(
      getDescriptionHtmlUrl({ metadata: { html: 'html/x.repeatMasker' } }),
    ).toBeUndefined()
  })

  // the url reaches openLocation and the "View original" anchor, so a scheme
  // that is not http(s) never becomes one
  it('is undefined for a non-http scheme', () => {
    expect(
      getDescriptionHtmlUrl({
        metadata: { html: '<a href="javascript:alert(1)">x</a>' },
      }),
    ).toBeUndefined()
    expect(
      getDescriptionHtmlUrl({
        metadata: { html: '<a href="file:///etc/passwd">x</a>' },
      }),
    ).toBeUndefined()
  })
})

describe('rebaseDescriptionHtml', () => {
  it('resolves relative links and images against the page', () => {
    const out = rebaseDescriptionHtml(
      '<p><a href="../bbi/x.bb">file</a><img src="mammals.png"></p>',
      base,
    )
    expect(out).toContain(
      'https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.4/bbi/x.bb',
    )
    expect(out).toContain(
      'https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.4/html/mammals.png',
    )
  })

  // what UCSC's own repeatMasker page uses for its nine screenshots
  it('resolves a root-relative path against the origin', () => {
    expect(
      rebaseDescriptionHtml('<img src="/images/rmskDense.jpg">', base),
    ).toContain('https://hgdownload.soe.ucsc.edu/images/rmskDense.jpg')
  })

  it('leaves absolute links alone', () => {
    expect(
      rebaseDescriptionHtml('<a href="https://ncbi.nlm.nih.gov/x">n</a>', base),
    ).toContain('https://ncbi.nlm.nih.gov/x')
  })

  // the MANE page the feature request pointed at is a whole document; taking
  // the body is what keeps its <title> from arriving as stray text
  it('takes the body of a whole document', () => {
    const out = rebaseDescriptionHtml(
      '<html><head><title>MANE Select</title></head><body><h2>Description</h2></body></html>',
      base,
    )
    expect(out).toContain('<h2>Description</h2>')
    expect(out).not.toContain('MANE Select')
  })

  // dompurify's default config keeps forms, and this is the only place JBrowse
  // renders a whole document off a third-party origin
  it('drops a form', () => {
    const out = rebaseDescriptionHtml(
      '<p>real</p><form action="https://evil.example/x"><input name="password"></form>',
      base,
    )
    expect(out).toContain('real')
    expect(out).not.toContain('form')
    expect(out).not.toContain('password')
  })

  it('passes a bare fragment through', () => {
    expect(rebaseDescriptionHtml('<h2>Description</h2><p>hi</p>', base)).toBe(
      '<h2>Description</h2><p>hi</p>',
    )
  })
})
