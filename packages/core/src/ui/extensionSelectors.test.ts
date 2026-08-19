import { matchesTrackSelector } from './extensionSelectors.ts'

// The predicate every track-scoped extension point contribution uses to say
// which tracks it is for. The copy-track cases are the ones worth having: a
// hand-written `trackId === 'x'` passes the first two and fails the rest.

test('an empty selector matches everything', () => {
  expect(matchesTrackSelector({}, { model: { trackId: 'anything' } })).toBe(
    true,
  )
})

test('every field given has to match', () => {
  const select = { trackType: 'VariantTrack', trackId: 'volvox.inv.vcf' }
  expect(matchesTrackSelector(select, { model: { ...select } })).toBe(true)
  expect(
    matchesTrackSelector(select, { model: { trackType: 'VariantTrack' } }),
  ).toBe(false)
})

test('a field can name several accepted values', () => {
  const select = { trackType: ['VariantTrack', 'AlignmentsTrack'] }
  expect(
    matchesTrackSelector(select, { model: { trackType: 'AlignmentsTrack' } }),
  ).toBe(true)
  expect(
    matchesTrackSelector(select, { model: { trackType: 'FeatureTrack' } }),
  ).toBe(false)
})

test('widgetType matches the widget model type, not the track type', () => {
  const select = { widgetType: 'AlignmentsFeatureWidget' }
  expect(
    matchesTrackSelector(select, {
      model: { type: 'AlignmentsFeatureWidget' },
    }),
  ).toBe(true)
  expect(
    matchesTrackSelector(select, { model: { type: 'BaseFeatureWidget' } }),
  ).toBe(false)
})

// the reason the framework owns the matching: copyTrackSnapshot appends
// `-${Date.now()}`, and copying a copy appends again
test('a bare trackId matches the users copies of that track', () => {
  const select = { trackId: 'volvox.inv.vcf' }
  for (const trackId of [
    'volvox.inv.vcf',
    'volvox.inv.vcf-1712000000000',
    'volvox.inv.vcf-1712000000000-1712000000001',
  ]) {
    expect(matchesTrackSelector(select, { model: { trackId } })).toBe(true)
  }
})

test('a bare trackId does not match an unrelated longer id', () => {
  const select = { trackId: 'volvox.inv.vcf' }
  for (const trackId of ['volvox.inv.vcf-extra', 'volvox.inv.vcf2']) {
    expect(matchesTrackSelector(select, { model: { trackId } })).toBe(false)
  }
})

test('a regex trackId is matched as written', () => {
  const select = { trackId: /^volvox\./ }
  expect(
    matchesTrackSelector(select, { model: { trackId: 'volvox.bam' } }),
  ).toBe(true)
  expect(
    matchesTrackSelector(select, { model: { trackId: 'other.bam' } }),
  ).toBe(false)
})

// the About points hand over a track config rather than a widget model, and a
// config's `type` is the track type
test('a track config is selected on the same fields as a model', () => {
  const select = { trackType: 'VariantTrack', trackId: 'volvox.inv.vcf' }
  expect(
    matchesTrackSelector(select, {
      config: { type: 'VariantTrack', trackId: 'volvox.inv.vcf' },
    }),
  ).toBe(true)
  expect(
    matchesTrackSelector(select, {
      config: { type: 'FeatureTrack', trackId: 'volvox.inv.vcf' },
    }),
  ).toBe(false)
})

test('a config copy of the selected track still matches', () => {
  expect(
    matchesTrackSelector(
      { trackId: 'volvox.inv.vcf' },
      { config: { trackId: 'volvox.inv.vcf-1712000000000' } },
    ),
  ).toBe(true)
})

test('a subject carrying neither a model nor a config matches only an empty selector', () => {
  expect(matchesTrackSelector({}, {})).toBe(true)
  expect(matchesTrackSelector({ trackType: 'VariantTrack' }, {})).toBe(false)
})
