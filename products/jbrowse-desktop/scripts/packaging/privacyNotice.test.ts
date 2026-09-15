import { privacyNoticeText } from './privacyNotice.ts'

const siteUrl = 'https://jbrowse.org/jb2'
const notice = (markdown: string) => privacyNoticeText(markdown, { siteUrl })

const policy = `---
layout: '../layouts/MarkdownLayout.astro'
title: Privacy policy
---

# Privacy policy

When jbrowse-desktop loads, it sends an anonymous usage report.

To opt out, set \`disableAnalytics: true\` in your config
([details](/docs/config_guides/disable_analytics)), or read the
[Google privacy policy](https://policies.google.com/privacy).
`

// The frontmatter is Astro's, and the license page would show it verbatim —
// three lines of layout path above the sentence that matters.
test('the frontmatter does not reach the installer', () => {
  expect(notice(policy)).not.toContain('MarkdownLayout')
  expect(notice(policy).startsWith('Privacy policy')).toBe(true)
})

// Nothing on the page is clickable, so a link that keeps only its text tells
// the reader to go somewhere they cannot get to.
test('a link keeps its text and gains an address to type', () => {
  expect(notice(policy)).toContain(
    'Google privacy policy (https://policies.google.com/privacy)',
  )
})

// The policy is written for the website, where a root-relative href resolves
// against the site. On a page with no site it resolves against nothing.
test('a site-relative link is made absolute', () => {
  expect(notice(policy)).toContain(
    `${siteUrl}/docs/config_guides/disable_analytics`,
  )
})

test('markdown syntax is gone', () => {
  const text = notice(policy)
  expect(text).not.toContain('`')
  expect(text).not.toContain('#')
  expect(text).not.toContain('](')
})

// The control does not wrap; a long line scrolls off the right instead.
test('every line fits the license control', () => {
  for (const line of notice(policy).split('\r\n')) {
    expect(line.length).toBeLessThanOrEqual(76)
  }
})

// A URL broken across two lines is one nobody can retype, so it overruns
// rather than splits.
test('a URL longer than the width stays on one line', () => {
  const long = `https://example.com/${'x'.repeat(100)}`
  const text = notice(`a [link](${long}) b`)
  expect(text).toContain(long)
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

// An empty notice compiles into a perfectly good installer that discloses
// nothing, which is the one outcome this file exists to prevent.
test('a policy that flattens to nothing is refused', () => {
  expect(() => notice('---\ntitle: x\n---\n')).toThrow(/came out empty/)
})
