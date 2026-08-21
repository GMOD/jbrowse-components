import { namesTemporaryAssembly } from './temporaryAssembly.ts'

const SESSION = { temporaryAssemblies: [{ name: 'der_chr3_1' }] }

const SEGMENTS = {
  trackId: 'derivative-segments-1',
  type: 'FeatureTrack',
  assemblyNames: ['der_chr3_1'],
}

test('a track on a temporary assembly is one', () => {
  expect(namesTemporaryAssembly(SESSION, SEGMENTS)).toBe(true)
})

test('a track on a permanent assembly is not', () => {
  expect(
    namesTemporaryAssembly(SESSION, {
      trackId: 'my-genes',
      type: 'FeatureTrack',
      assemblyNames: ['hg38'],
    }),
  ).toBe(false)
})

// `some`, and this is the case that makes it the right question. A synteny band
// spans [the real reference, the synthetic read], so `every` would call it
// permanent — and it cannot be drawn either once the read assembly goes back.
// The sweep ADR-084 removed needed `every` because it DELETED; a question asked
// at the write has no such constraint.
test('a track spanning a temporary and a permanent assembly is one', () => {
  expect(
    namesTemporaryAssembly(SESSION, {
      trackId: 'read-vs-ref',
      type: 'SyntenyTrack',
      assemblyNames: ['hg38', 'der_chr3_1'],
    }),
  ).toBe(true)
})

test('a session holding no temporary assembly never reports', () => {
  expect(namesTemporaryAssembly({ temporaryAssemblies: [] }, SEGMENTS)).toBe(
    false,
  )
  expect(namesTemporaryAssembly({}, SEGMENTS)).toBe(false)
})

// `some` is false of nothing, so a config naming no assembly needs no guard of
// its own — unlike the sweep, where `every` was true of nothing and an
// assembly-less config would have been swept by any route that reached it.
test('a track naming no assembly is not one', () => {
  expect(
    namesTemporaryAssembly(SESSION, { trackId: 'bare', type: 'FeatureTrack' }),
  ).toBe(false)
  expect(
    namesTemporaryAssembly(SESSION, {
      trackId: 'empty',
      type: 'FeatureTrack',
      assemblyNames: [],
    }),
  ).toBe(false)
})
