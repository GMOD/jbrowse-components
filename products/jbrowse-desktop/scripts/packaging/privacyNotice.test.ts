import { privacyNoticeText } from './privacyNotice.ts'

const siteUrl = 'https://jbrowse.org/jb2'
const policyUrl = `${siteUrl}/privacy/`
const notice = (markdown: string) =>
  privacyNoticeText(markdown, { siteUrl, policyUrl })

// A marked region holding exactly `body`, for the tests about one sentence
// rather than about the page.
const marked = (body: string) =>
  notice(
    `<!-- installer notice start -->\n${body}\n<!-- installer notice end -->`,
  )

const policy = `---
layout: '../layouts/MarkdownLayout.astro'
title: Privacy policy
---

# Privacy policy

<!-- installer notice start -->

When jbrowse-desktop loads, it sends an anonymous usage report, and Google
handles its copy under the
[Google privacy policy](https://policies.google.com/privacy).

<!-- installer notice end -->

This website uses Google Analytics after you click OK on its banner.

To opt out, set \`disableAnalytics: true\` in your config
([details](/docs/config_guides/disable_analytics)).
`

// An installer window is a worse place to read than a web page, so it gets the
// part that is about the app. What the site says about its own cookie banner is
// true and irrelevant to somebody installing a desktop application.
test('only the marked region reaches the installer', () => {
  const text = notice(policy)
  expect(text).toContain('anonymous usage report')
  expect(text).not.toContain('banner')
  expect(text).not.toContain('MarkdownLayout')
  expect(text).not.toContain('installer notice')
})

// The notice is an extract, so it has to say where the rest is — and that line
// is generated rather than written into the page, which would read as a link to
// itself there.
test('the notice ends at the whole policy', () => {
  expect(
    notice(policy).trimEnd().endsWith(`Full privacy policy: ${policyUrl}`),
  ).toBe(true)
})

// Nothing on the page is clickable, so a link that keeps only its text tells
// the reader to go somewhere they cannot get to.
test('a link keeps its text and gains an address to type', () => {
  expect(
    marked('[Google](https://policies.google.com/privacy) handles it'),
  ).toContain('Google (https://policies.google.com/privacy)')
})

// The policy is written for the website, where a root-relative href resolves
// against the site. On a page with no site it resolves against nothing.
test('a site-relative link is made absolute', () => {
  expect(
    marked('see [details](/docs/config_guides/disable_analytics)'),
  ).toContain(`${siteUrl}/docs/config_guides/disable_analytics`)
})

test('markdown syntax is gone', () => {
  const text = notice(policy)
  expect(text).not.toContain('`')
  expect(text).not.toContain('#')
  expect(text).not.toContain('](')
})

test('every line fits the width the notice is wrapped to', () => {
  for (const line of notice(policy).split('\r\n')) {
    expect(line.length).toBeLessThanOrEqual(76)
  }
})

// A URL broken across two lines is one nobody can retype, so it overruns
// rather than splits.
test('a URL longer than the width stays on one line', () => {
  const long = `https://example.com/${'x'.repeat(100)}`
  expect(marked(`a [link](${long}) b`)).toContain(long)
})

// Paragraphs are what makes it readable, and the source marks them with blank
// lines that the flattening would otherwise eat.
test('paragraphs stay apart', () => {
  expect(notice(policy)).toContain('\r\n\r\n')
})

// The RichEdit control puts a bare LF on the same visual line, so an LF-only
// file renders as one very long paragraph.
test('the file is CRLF throughout', () => {
  expect(notice(policy).replaceAll('\r\n', '')).not.toContain('\n')
})

// Losing the markers would otherwise fall back to some part of the page, and
// which part is not something the installer should be guessing at.
test('a policy with no marked region is refused', () => {
  expect(() => notice('# Privacy policy\n\nWe collect nothing.\n')).toThrow(
    /no <!-- installer notice start -->/,
  )
})

// An empty notice compiles into a perfectly good installer that discloses
// nothing, which is the one outcome this file exists to prevent.
test('a marked region with nothing in it is refused', () => {
  expect(() => marked('')).toThrow(/came out empty/)
})
