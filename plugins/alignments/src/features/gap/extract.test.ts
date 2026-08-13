import { getEffectiveStrand } from './extract.ts'

import type { Feature } from '@jbrowse/core/util'

// Two stubs on purpose. `getEffectiveStrand` reads its three tags through
// `getTagAlt`/`getTag`, which duck-type the feature's own targeted accessors and
// fall back to the full `get('tags')` object when it has none — BAM and CRAM
// take the first path, a PAF/synteny feature the second. A test that only built
// one of them would not notice the two disagreeing, which is exactly what the
// move off `get('tags')` could have broken.
function tagged(tags: Record<string, string>, strand: -1 | 1 = 1): Feature {
  const fields: Record<string, unknown> = { tags, strand }
  return {
    get: (k: string) => fields[k],
    getTag: (t: string) => tags[t],
    getTagAlt: (t: string, alt: string) => tags[t] ?? tags[alt],
  } as unknown as Feature
}

// no targeted accessors: the `get('tags')` fallback path
function untagged(tags: Record<string, string>, strand: -1 | 1 = 1): Feature {
  const fields: Record<string, unknown> = { tags, strand }
  return { get: (k: string) => fields[k] } as unknown as Feature
}

describe.each([
  ['targeted accessors', tagged],
  ['get(tags) fallback', untagged],
])('%s', (_name, make) => {
  test('XS gives the library strand directly', () => {
    expect(getEffectiveStrand(make({ XS: '+' }))).toBe(1)
    expect(getEffectiveStrand(make({ XS: '-' }))).toBe(-1)
  })

  test('XS is absolute — the read strand does not flip it', () => {
    expect(getEffectiveStrand(make({ XS: '+' }, -1))).toBe(1)
    expect(getEffectiveStrand(make({ XS: '-' }, 1))).toBe(-1)
  })

  test('TS stands in for XS when the aligner spelled it that way', () => {
    expect(getEffectiveStrand(make({ TS: '+' }))).toBe(1)
    expect(getEffectiveStrand(make({ TS: '-' }))).toBe(-1)
  })

  test('XS wins over TS when a read carries both', () => {
    expect(getEffectiveStrand(make({ XS: '-', TS: '+' }))).toBe(-1)
  })

  // minimap2's `ts` is the orientation of the read against the transcript, so
  // it only becomes a transcript strand once the read's own strand is applied.
  test('ts is relative to the read strand', () => {
    expect(getEffectiveStrand(make({ ts: '+' }, 1))).toBe(1)
    expect(getEffectiveStrand(make({ ts: '+' }, -1))).toBe(-1)
    expect(getEffectiveStrand(make({ ts: '-' }, 1))).toBe(-1)
    expect(getEffectiveStrand(make({ ts: '-' }, -1))).toBe(1)
  })

  test('XS is consulted before ts', () => {
    expect(getEffectiveStrand(make({ XS: '+', ts: '-' }, -1))).toBe(1)
  })

  test('no strand tag at all is unknown, not a strand', () => {
    expect(getEffectiveStrand(make({}, -1))).toBe(0)
    expect(getEffectiveStrand(make({ NM: '3' }, 1))).toBe(0)
  })

  // A value the spec does not define must read as unknown rather than as one of
  // the two strands — `xs === '+'` and `ts === '+'` are exact tests for that
  // reason.
  test('an unrecognised value is unknown', () => {
    expect(getEffectiveStrand(make({ XS: '?' }))).toBe(0)
    expect(getEffectiveStrand(make({ ts: '*' }, -1))).toBe(0)
  })
})
