import { findCrowdedPages } from './docLinks.ts'

test('a page past four sections is reported, and four is not', () => {
  const page = (slug: string, n: number) => ({
    slug,
    sections: Array.from({ length: n }, (_, i) => ({ slug: `${slug}-${i}` })),
  })
  expect(findCrowdedPages([page('four', 4), page('five', 5)])).toEqual([
    { slug: 'five', sections: 5, limit: 4 },
  ])
})
