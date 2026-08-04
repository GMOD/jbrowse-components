import { svgSafeId } from './svgId.ts'

// The ids the exports actually build today — from trackIds, displayIds and
// block keys — are all in the safe alphabet, so sanitizing must be a no-op on
// them. If this fails, every SVG snapshot in the repo just churned.
test.each([
  'track-clip-integration_test-volvox_alignments_pileup_coverage',
  'reflabel-integration_test-volvox:ctgA:0:80:0',
  'ruler-clip-AcZl9Uifbv',
  'score-ramp-t1-display',
  'hic-gradient-juicebox-Xy_9.2',
])('leaves the already-safe id %s alone', id => {
  expect(svgSafeId(id)).toBe(id)
})

// The characters that actually break things: an unquoted url() token can't hold
// whitespace, parens or quotes, and `#` would end the fragment early.
test.each([
  ['Genes (curated)', 'Genes~20~~28~curated~29~'],
  ['gi|123|ref|NC_000001|', 'gi~7c~123~7c~ref~7c~NC_000001~7c~'],
  ["it's a track", 'it~27~s~20~a~20~track'],
  ['a#b', 'a~23~b'],
])('escapes %s', (raw, escaped) => {
  expect(svgSafeId(raw)).toBe(escaped)
})

// The reason `~` escapes itself. Without that, `a b` and `a~20~b` would both
// map to `a~20~b`, and the second track's clipPath would silently steal the
// first's — the exact failure the sanitizing is meant to prevent.
test('keeps ids that differ only in an unsafe character distinct', () => {
  expect(svgSafeId('a b')).not.toBe(svgSafeId('a~20~b'))
})

// The flip side of that: escaping the marker means a second pass re-escapes the
// first pass's output, which is why this is applied exactly once, where the id
// and its url() reference are both emitted. Asserted so the non-idempotency is
// a documented property rather than something a caller trips over.
test('is not idempotent, so it must be applied once', () => {
  const once = svgSafeId('Genes (curated)')
  expect(svgSafeId(once)).not.toBe(once)
})
