import { isLooseTrack, withAssemblyName } from './controllerTracks.ts'

test('stamps the assembly name onto a config that omits assemblyNames', () => {
  expect(
    withAssemblyName({ type: 'FeatureTrack', trackId: 't' }, 'volvox'),
  ).toEqual({ type: 'FeatureTrack', trackId: 't', assemblyNames: ['volvox'] })
})

test('leaves an existing assemblyNames untouched', () => {
  const track = { trackId: 't', assemblyNames: ['hg38'] }
  expect(withAssemblyName(track, 'volvox')).toBe(track)
})

test('no-ops when the assembly name is unresolved', () => {
  const track = { trackId: 't' }
  expect(withAssemblyName(track, undefined)).toBe(track)
})

test('a bare URL and a { uri } object are loose; a full config is not', () => {
  expect(isLooseTrack('peaks.bed.gz')).toBe(true)
  expect(isLooseTrack({ uri: 'peaks.bed.gz', index: 'peaks.bed.gz.tbi' })).toBe(
    true,
  )
  expect(isLooseTrack({ trackId: 't', adapter: { type: 'X', uri: 'y' } })).toBe(
    false,
  )
})
