import { parseTrackConfigs } from './parseTrackConfigs.ts'

test('parses a single track config object', () => {
  const confs = parseTrackConfigs('{"trackId":"t1","type":"FeatureTrack"}')
  expect(confs).toEqual([{ trackId: 't1', type: 'FeatureTrack' }])
})

test('parses an array of track configs', () => {
  const confs = parseTrackConfigs(
    '[{"trackId":"t1","type":"FeatureTrack"},{"trackId":"t2","type":"VariantTrack"}]',
  )
  expect(confs).toHaveLength(2)
})

test('throws a friendly message for malformed JSON', () => {
  expect(() => parseTrackConfigs('{not json')).toThrow(/Could not parse JSON/)
})

test('throws for an empty array instead of silently adding nothing', () => {
  expect(() => parseTrackConfigs('[]')).toThrow(/No track configuration found/)
})

test('throws for non-object JSON', () => {
  expect(() => parseTrackConfigs('42')).toThrow(/must be a JSON object/)
})

test('reports which entry is missing trackId', () => {
  expect(() =>
    parseTrackConfigs('[{"trackId":"t1","type":"FeatureTrack"},{"type":"x"}]'),
  ).toThrow(/at index 1 is missing a "trackId"/)
})

test('reports a missing type', () => {
  expect(() => parseTrackConfigs('{"trackId":"t1"}')).toThrow(
    /missing a "type"/,
  )
})
