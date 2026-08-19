import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  absolutizeImages,
  fillReleaseStats,
  findReleasePost,
  formatDiffstat,
  parseReleaseFilename,
  parseReleasePost,
  releasePostFilename,
  releaseTimestamp,
  renderReleasePost,
  DRAFTS_DIR,
  CHANGELOG_HEADING,
  releaseDraftPaths,
  splitReleaseBody,
  stripImages,
} from './releaseBlog.ts'

const template = readFileSync(path.join(__dirname, 'blog_template.txt'), 'utf8')
const notes = 'Adds a thing.\n\n- one\n- two'
const changelog =
  '## Changes since v4.3.0 (2026-07-01)\n\n### bug\n\n- fixed it'

const render = (tag: string, date: string) =>
  renderReleasePost({
    template,
    tag,
    date: `${date} 10:11:12`,
    notes,
    changelog,
  })

// release.yml fills the GitHub release body by parsing the post release.ts
// wrote, falling back to a placeholder if that throws. Without this, editing
// blog_template.txt would silently blank the release body.
test('a rendered post parses back into the same notes and changelog', () => {
  const post = render('v4.4.0', '2026-07-22')
  expect(post).not.toMatch(/\$\{/)

  const file = releasePostFilename('v4.4.0', '2026-07-22')
  expect(parseReleaseFilename(file)).toEqual({
    y: '2026',
    m: '07',
    d: '22',
    slug: 'v4.4.0-release',
    tag: 'v4.4.0',
  })

  const { title, body } = parseReleasePost(post, file)
  expect(title).toBe('v4.4.0 Release')
  expect(splitReleaseBody(body)).toEqual({ notes, changelog })
})

// getMonth() is 0-based, and a release runs once a month with no dry run: an
// off-by-one here dates the post a month out and, because the date prefix is
// what orders the blog, files it in the wrong place too.
test('releaseTimestamp pads, and does not lose the month off-by-one', () => {
  expect(releaseTimestamp(new Date(2026, 0, 3, 9, 4, 5))).toEqual({
    date: '2026-01-03',
    datetime: '2026-01-03 09:04:05',
  })
  expect(releaseTimestamp(new Date(2026, 11, 31, 23, 59, 59))).toEqual({
    date: '2026-12-31',
    datetime: '2026-12-31 23:59:59',
  })
  // local, not UTC: an evening release must not be dated tomorrow
  const evening = new Date(2026, 6, 22, 21, 30, 0)
  expect(releaseTimestamp(evening).date).toBe('2026-07-22')
  // and it is exactly what the post filename is built from
  expect(releasePostFilename('v4.4.0', releaseTimestamp(evening).date)).toBe(
    '2026-07-22-v4.4.0-release.md',
  )
})

// release.ts writes the post and pushes in one run, so a draft that kept the
// repo-relative paths it was reviewed with has to be corrected here or it ships
// with every figure broken.
test('rendering a post rewrites repo-relative figures to site-root', () => {
  const post = renderReleasePost({
    template,
    tag: 'v5.0.0',
    date: '2026-08-04 10:11:12',
    notes: '![a caption](../static/img/gwas/manhattan.png)\n\nprose',
    changelog,
  })
  expect(post).toContain('![a caption](/img/gwas/manhattan.png)')
  expect(post).not.toContain('../static/img/')
})

// A draft's notes-to-self are invisible on the blog but not downstream:
// announce.ts escapes HTML, so a comment would reach the newsletter as text.
test('rendering a post drops the draft-only HTML comments', () => {
  const post = renderReleasePost({
    template,
    tag: 'v5.0.0',
    date: '2026-08-04 10:11:12',
    notes: '<!--\nTODO: fill in the tag\n-->\n\nprose\n\n<!-- and this -->\n',
    changelog,
  })
  expect(post).not.toContain('<!--')
  expect(post).not.toContain('TODO')
  expect(post).toContain('\nprose\n')
})

test('a path that is already site-root, or external, is left alone', () => {
  const notes = [
    '![a](/img/already.png)',
    '![b](https://example.com/x.png)',
    'prose mentioning ../static/img/ and /img/ outside an image',
  ].join('\n\n')
  expect(
    renderReleasePost({
      template,
      tag: 'v5.0.0',
      date: '2026-08-04 10:11:12',
      notes,
      changelog,
    }),
  ).toContain(notes)
})

// The release body is GitHub-rendered, so a site-root path misses the figure.
test('absolutizeImages points figures at the deployed site', () => {
  expect(absolutizeImages('![a](/img/gwas/manhattan.png)')).toBe(
    '![a](https://jbrowse.org/jb2/img/gwas/manhattan.png)',
  )
  expect(absolutizeImages('![a](https://example.com/x.png)')).toBe(
    '![a](https://example.com/x.png)',
  )
})

// The newsletter's mdToHtml has no image case, so figures have to go.
test('stripImages drops figure lines and closes the gap they leave', () => {
  expect(
    stripImages('one\n\n![a](/img/a.png)\n\n![b](/img/b.png)\n\ntwo\n'),
  ).toBe('one\n\ntwo')
})

test('findReleasePost selects by tag, not recency', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-blog-'))
  for (const [tag, date] of [
    ['v4.3.0', '2026-07-01'],
    ['v4.4.0', '2026-07-22'],
  ] as const) {
    writeFileSync(
      path.join(dir, releasePostFilename(tag, date)),
      render(tag, date),
    )
  }
  writeFileSync(path.join(dir, '2026-07-30-office-hours.md'), 'not a release')

  expect(findReleasePost(undefined, dir)).toBe('2026-07-22-v4.4.0-release.md')
  expect(findReleasePost('v4.3.0', dir)).toBe('2026-07-01-v4.3.0-release.md')
  expect(() => findReleasePost('v9.9.9', dir)).toThrow('no release blog post')
})

// check-release-drafts.ts gates a hand-written changelog override on
// CHANGELOG_HEADING, but what the section has to survive is splitReleaseBody's
// own regex. Two regexes for one heading, in two files, is exactly the pair
// that drifts — and the failure is silent: the override renders into the post
// and then vanishes from the GitHub release body and the newsletter.
test('CHANGELOG_HEADING accepts what splitReleaseBody finds, and no more', () => {
  const accepted = ['## Changes since v4.3.0 (2026-05-21)', '### Changes since']
  for (const heading of accepted) {
    expect(CHANGELOG_HEADING.test(heading)).toBe(true)
    expect(
      splitReleaseBody(`prose\n\n## Downloads\n\nlinks\n\n${heading}\n\n- a`)
        .changelog,
    ).toBe(`${heading}\n\n- a`)
  }
  for (const heading of [
    'Changes since v4.3.0',
    '## Changelog',
    '## Changes',
  ]) {
    expect(CHANGELOG_HEADING.test(heading)).toBe(false)
    expect(
      splitReleaseBody(`prose\n\n## Downloads\n\nlinks\n\n${heading}\n\n- a`)
        .changelog,
    ).toBe('')
  }
})

// release.ts derives both from the tag; check-release-drafts.ts recognizes the
// override by pattern. A rename on either side orphans the file, and the
// release silently falls back to the generated PR list.
test('releaseDraftPaths names the two files a release consumes', () => {
  expect(releaseDraftPaths('v5.0.0')).toEqual({
    notes: `${DRAFTS_DIR}/v5.0.0.md`,
    changelog: `${DRAFTS_DIR}/v5.0.0.changelog.md`,
  })
})

// The one figure the draft cannot hold, because it moves under every commit.
test("formatDiffstat reads git shortstat into the post's own voice", () => {
  expect(
    formatDiffstat(
      ' 9166 files changed, 1011355 insertions(+), 295862 deletions(-)',
    ),
  ).toBe('9,166 files changed, +1,011,355 / \u2212295,862 lines')
})

test('formatDiffstat throws rather than publishing half a sentence', () => {
  expect(() => formatDiffstat(' 3 files changed, 7 insertions(+)')).toThrow(
    /Cannot read a diffstat/,
  )
})

// A stat the release did not compute stays as it was written, so
// check-release-drafts is the thing that catches it and not a silent blank.
test('fillReleaseStats leaves a name it was given no value for', () => {
  expect(
    fillReleaseStats('a ${DIFFSTAT} b ${NOPE}', { DIFFSTAT: '1 file' }),
  ).toBe('a 1 file b ${NOPE}')
})

// The template pass inserts NOTES literally rather than rescanning it, so a
// draft's placeholder is only ever filled by the notes pass. Without that pass
// it reaches the published post as nine characters.
test('a draft placeholder is filled on the way into the post', () => {
  const post = renderReleasePost({
    template,
    tag: 'v5.0.0',
    date: '2026-09-01 10:11:12',
    notes: 'Comparing the tags: ${DIFFSTAT}.',
    changelog,
    stats: { DIFFSTAT: '9,166 files changed' },
  })
  expect(post).toContain('Comparing the tags: 9,166 files changed.')
  expect(post).not.toMatch(/\$\{/)
})
