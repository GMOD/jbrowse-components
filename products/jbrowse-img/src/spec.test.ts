import { initFromSpec, parseSpec } from './spec.ts'

const view = { type: 'LinearGenomeView', assembly: 'hg38', loc: 'chr1:1-100' }

test('takes a bare view object or the { views: [...] } wrapper', () => {
  expect(parseSpec(JSON.stringify(view)).view).toEqual(view)
  expect(parseSpec(JSON.stringify({ views: [view] })).view).toEqual(view)
})

test('a spec that is not a view says so', () => {
  expect(() => parseSpec('{"loc":"chr1:1-100"}')).toThrow(/must be a view/)
})

// The view names a session track by trackId like any other, so dropping the
// configs left the run dying on `Could not resolve identifier` — a message that
// reads like a bad spec rather than like a key the parser ignored. Every
// `&session=spec-` URL that carries its own tracks lands here.
test('session tracks travel with the view', () => {
  const track = { trackId: 'promoters', type: 'FeatureTrack' }
  const parsed = parseSpec(
    JSON.stringify({ sessionTracks: [track], views: [view] }),
  )
  expect(parsed.sessionTracks).toEqual([track])
  expect(parsed.view).toEqual(view)
})

test('no sessionTracks key is an empty list, not undefined', () => {
  expect(parseSpec(JSON.stringify({ views: [view] })).sessionTracks).toEqual([])
})

test('initFromSpec drops only the type discriminator', () => {
  expect(initFromSpec(view)).toEqual({ assembly: 'hg38', loc: 'chr1:1-100' })
})
