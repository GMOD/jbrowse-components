import { quickStartSyntenyTracks, syntenyTrackRows } from './syntenyTrackRows.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const track = (trackId: string, type: string, assemblyNames: string[]) =>
  ({
    trackId,
    type,
    configuration: { assemblyNames },
  }) as unknown as AnyConfigurationModel

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: (t: { configuration: { assemblyNames: string[] } }) =>
    t.configuration.assemblyNames,
}))

const cross = track('cross', 'SyntenyTrack', ['a', 'b'])
const ava = track('ava', 'SyntenyTrack', ['a', 'b', 'c', 'd'])
const selfA = track('selfA', 'SyntenyTrack', ['a', 'a'])
const lone = track('lone', 'SyntenyTrack', ['a'])
const feature = track('feature', 'FeatureTrack', ['a', 'b'])

test('a pairwise track fills two rows', () => {
  expect(syntenyTrackRows(cross)).toEqual(['a', 'b'])
})

test('an all-vs-all track stacks every assembly it names', () => {
  expect(syntenyTrackRows(ava)).toEqual(['a', 'b', 'c', 'd'])
})

test('a self-alignment track keeps its repeated assembly', () => {
  expect(syntenyTrackRows(selfA)).toEqual(['a', 'a'])
})

test('quick start offers every launchable synteny track', () => {
  expect(quickStartSyntenyTracks([cross, ava, selfA, feature])).toEqual([
    cross,
    ava,
    selfA,
  ])
})

test('quick start omits a track naming fewer than two assemblies', () => {
  expect(quickStartSyntenyTracks([cross, lone])).toEqual([cross])
})
