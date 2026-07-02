import { getTag, getTagAlt } from './getTagAlt.ts'

import type { Feature } from '@jbrowse/core/util'

// Feature exposing both a targeted getTag (BAM-like) and a full tags object, so
// we can assert the targeted path returns exactly what the tags object would.
function taggedFeature(tags: Record<string, unknown>) {
  return {
    getTag: (t: string) => tags[t],
    get: (field: string) => (field === 'tags' ? tags : undefined),
  } as unknown as Feature
}

// Feature with no getTag (CRAM/synteny), only the full tags object.
function tagsOnlyFeature(tags: Record<string, unknown>) {
  return {
    get: (field: string) => (field === 'tags' ? tags : undefined),
  } as unknown as Feature
}

const tags = { MM: 'C+m,1,2;', ML: new Uint8Array([200, 10]), NM: 3 }

test('getTag targeted path matches the full tags object', () => {
  const f = taggedFeature(tags)
  expect(getTag(f, 'MM')).toBe(tags.MM)
  expect(getTag(f, 'ML')).toBe(tags.ML)
  expect(getTag(f, 'ZZ')).toBeUndefined()
})

test('getTag falls back to tags object when getTag is absent', () => {
  const f = tagsOnlyFeature(tags)
  expect(getTag(f, 'MM')).toBe(tags.MM)
  expect(getTag(f, 'ZZ')).toBeUndefined()
})

test('getTagAlt prefers canonical name, falls back to alias', () => {
  expect(getTagAlt(taggedFeature({ MM: 'a' }), 'MM', 'Mm')).toBe('a')
  expect(getTagAlt(taggedFeature({ Mm: 'b' }), 'MM', 'Mm')).toBe('b')
  expect(getTagAlt(tagsOnlyFeature({ Ml: new Uint8Array([1]) }), 'ML', 'Ml')).toEqual(
    new Uint8Array([1]),
  )
  expect(getTagAlt(taggedFeature({}), 'MM', 'Mm')).toBeUndefined()
})
