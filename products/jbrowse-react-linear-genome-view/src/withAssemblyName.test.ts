import { withAssemblyName } from './createLinearGenomeView.ts'

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
