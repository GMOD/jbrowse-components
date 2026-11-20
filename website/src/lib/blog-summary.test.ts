import { blogFeed, blogSummary } from './blog-summary.ts'

const release = (intro: string, sections: string[]) =>
  [
    intro,
    ...sections.map(s => `## ${s}\n\nText.`),
    '## Downloads\n\n- [link](https://example.org)',
    '## Changes since v1.0.0\n\n### bug\n\n- A fix',
  ].join('\n\n')

test('highlights are the headings above the downloads', () => {
  const { highlights } = blogSummary(
    '2025-01-01-v2.0.0-release',
    release('Intro.', ['Phased VCF', 'Turbo zoom']),
  )
  expect(highlights).toEqual(['Phased VCF', 'Turbo zoom'])
})

test('a Highlights section contributes its subheadings', () => {
  const body = [
    'Intro.',
    '## Highlights',
    '### One grammar',
    'Text.',
    '### GPU rendering',
    '## Upgrading',
  ].join('\n\n')
  expect(blogSummary('2026-12-01-v5.0.0-release', body).highlights).toEqual([
    'One grammar',
    'GPU rendering',
  ])
})

test('the lede drops a greeting and keeps version numbers whole', () => {
  const { lede } = blogSummary(
    '2026-01-17-v4.0.4-release',
    'Hello all, this fixes some minor bugs reported in the v4.0.3 release. More.',
  )
  expect(lede).toBe('This fixes some minor bugs reported in the v4.0.3 release.')
})

test('an abbreviation does not end the lede', () => {
  const { lede } = blogSummary(
    '2025-05-13-v3.4.0-release',
    'Search ranks results (e.g. gene names) better. More.',
  )
  expect(lede).toBe('Search ranks results (e.g. gene names) better.')
})

test('a picture features a minor release but not a patch release', () => {
  const body = release('Intro.\n\n![](/img/a.png)', [])
  expect(blogSummary('2025-04-18-v3.3.0-release', body).featured).toBe(true)
  expect(blogSummary('2025-04-19-v3.3.1-release', body).featured).toBe(false)
})

test('the feed splits each year into featured posts and the rest', () => {
  const post = (id: string, body: string) => ({
    id,
    body,
    title: id,
    date: new Date(id.slice(0, 10)),
    href: `/${id}`,
  })
  const card = release('Intro.', ['A', 'B'])
  const years = blogFeed([
    post('2026-02-01-v4.1.2-release', 'Fix.'),
    post('2026-01-20-v4.1.1-release', 'Fix.'),
    post('2026-01-10-v4.1.0-release', card),
    post('2025-12-01-v4.0.1-release', 'Fix.'),
    post('2025-11-01-v4.0.0-release', card),
  ])
  const ids = (list: { id: string }[]) => list.map(p => p.id.slice(11, 17))
  expect(
    years.map(({ year, featured, others }) => [
      year,
      ids(featured),
      ids(others),
    ]),
  ).toEqual([
    ['2026', ['v4.1.0'], ['v4.1.2', 'v4.1.1']],
    ['2025', ['v4.0.0'], ['v4.0.1']],
  ])
})
