import { composeAnnouncement, linkFacets, mdToHtml } from './announceFormat.ts'

const enc = new TextEncoder()

// The facet is a byte range into the UTF-8 post, and Bluesky does not validate
// it — a wrong range underlines the wrong slice or drops the link, on a post
// nobody previews before it goes out.
test('linkFacets measures the URL in bytes, not string indices', () => {
  const url = 'https://github.com/GMOD/jbrowse-components/releases/tag/v4.4.0'
  for (const prefix of [
    'JBrowse v4.4.0 is out! Release notes and downloads: ',
    // non-ASCII earlier in the post moves byteStart past the string index
    'JBrowse v4.4.0 — läuft! Notes: ',
    '🧬🧬 JBrowse v4.4.0: ',
  ]) {
    const text = `${prefix}${url}`
    const [facet] = linkFacets(text, url)
    expect(facet!.index.byteStart).toBe(enc.encode(prefix).length)
    expect(facet!.index.byteEnd).toBe(enc.encode(text).length)
    // the slice the range names is exactly the URL
    expect(
      new TextDecoder().decode(
        enc.encode(text).subarray(facet!.index.byteStart, facet!.index.byteEnd),
      ),
    ).toBe(url)
  }
})

test('linkFacets emits nothing rather than a bogus range when the URL is absent', () => {
  expect(linkFacets('no link here', 'https://example.com')).toEqual([])
})

// The newsletter is the one channel with no preview and no undo, and mdToHtml
// is the only thing between the draft and a subscriber's inbox.
test('mdToHtml renders the blocks a release summary actually uses', () => {
  expect(
    mdToHtml(
      [
        '## What changed',
        '',
        'Adds `--flag` and **bold** support,',
        'wrapped across two source lines.',
        '',
        '- a bullet',
        '- one that wraps',
        '  onto a second line',
        '',
        'See https://jbrowse.org/jb2/ or [the docs](https://jbrowse.org/jb2/docs).',
      ].join('\n'),
    ),
  ).toBe(
    [
      '<h2>What changed</h2>',
      '<p>Adds <code>--flag</code> and <strong>bold</strong> support, wrapped across two source lines.</p>',
      '<ul><li>a bullet</li><li>one that wraps onto a second line</li></ul>',
      '<p>See <a href="https://jbrowse.org/jb2/">https://jbrowse.org/jb2/</a> or <a href="https://jbrowse.org/jb2/docs">the docs</a>.</p>',
    ].join('\n'),
  )
})

// Notes come from a markdown draft, so they can carry anything. Escaping runs
// before the inline pass, so a generic in prose can't open a tag.
test('mdToHtml escapes the prose before it linkifies it', () => {
  expect(mdToHtml('Renamed <Figure> & fixed "quotes"')).toBe(
    '<p>Renamed &lt;Figure&gt; &amp; fixed &quot;quotes&quot;</p>',
  )
  expect(mdToHtml('<script>alert(1)</script>')).not.toContain('<script>')
})

test('composeAnnouncement names one release across every channel', () => {
  const releaseUrl =
    'https://github.com/GMOD/jbrowse-components/releases/tag/v4.4.0'
  const m = composeAnnouncement({
    tag: 'v4.4.0',
    notes: 'Adds a thing.',
    releaseUrl,
  })
  for (const text of [m.socialText, m.subject, m.htmlBody, m.textBody]) {
    expect(text).toContain('v4.4.0')
  }
  expect(m.socialText).toContain(releaseUrl)
  expect(m.htmlBody).toContain('<p>Adds a thing.</p>')
  expect(m.textBody).toContain('Adds a thing.')
  // the social post's URL has to be findable for linkFacets to point at it
  expect(linkFacets(m.socialText, releaseUrl)).toHaveLength(1)
})
