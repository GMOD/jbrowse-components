import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  findReleasePost,
  parseReleaseFilename,
  parseReleasePost,
  releasePostFilename,
  renderReleasePost,
  splitReleaseBody,
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
