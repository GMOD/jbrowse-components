import { getAddRowOptions } from './syntenyTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const track = (trackId: string, assemblyNames: string[]) =>
  ({
    trackId,
    name: trackId,
    type: 'SyntenyTrack',
    assemblyNames,
  }) as unknown as AnyConfigurationModel

const session = (
  tracks: AnyConfigurationModel[],
  connectionTracks?: AnyConfigurationModel[],
) =>
  ({
    tracks,
    assemblies: [],
    connectionInstances: connectionTracks
      ? [{ tracks: connectionTracks }]
      : undefined,
  }) as unknown as AbstractSessionModel

test('each dataset referencing the terminal assembly is one option', () => {
  const options = getAddRowOptions(
    session([
      track('hg38_mm39', ['hg38', 'mm39']),
      track('hg38_rn7', ['hg38', 'rn7']),
    ]),
    'hg38',
  )
  expect(options).toEqual([
    { trackId: 'hg38_mm39', name: 'hg38_mm39', newAssembly: 'mm39' },
    { trackId: 'hg38_rn7', name: 'hg38_rn7', newAssembly: 'rn7' },
  ])
})

test('a dataset not referencing the terminal assembly is not an option', () => {
  expect(getAddRowOptions(session([track('a_b', ['a', 'b'])]), 'hg38')).toEqual(
    [],
  )
})

test('a connection dataset can extend the stack too', () => {
  // connections hold their tracks outside session.tracks
  const options = getAddRowOptions(
    session([], [track('hub_track', ['hg38', 'mm39'])]),
    'hg38',
  )
  expect(options).toEqual([
    { trackId: 'hub_track', name: 'hub_track', newAssembly: 'mm39' },
  ])
})

test('a self-alignment dataset adds the same assembly again', () => {
  // both endpoints are the terminal assembly, so there is no other one to find
  const options = getAddRowOptions(
    session([track('hg38_self', ['hg38', 'hg38'])]),
    'hg38',
  )
  expect(options).toEqual([
    { trackId: 'hg38_self', name: 'hg38_self', newAssembly: 'hg38' },
  ])
})
