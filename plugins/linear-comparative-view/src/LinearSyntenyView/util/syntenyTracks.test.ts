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
  // names the session has no assembly for at all — not merely one whose model
  // is still being built, which `has` deliberately answers true for
  unloaded: string[] = [],
) =>
  ({
    tracks,
    assemblies: [],
    // hg19 is an alias of hg38 here purely so one test can cover the resolution;
    // every other name is already canonical
    assemblyManager: {
      getCanonicalAssemblyName: (name: string) =>
        unloaded.includes(name) ? undefined : name === 'hg19' ? 'hg38' : name,
      has: (name: string) => !unloaded.includes(name),
    },
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

// Not a broken row but a broken view: the row's init fails with "Assembly X
// not found", which sets the whole synteny view's error, and showImportForm
// reads that error — so an offered option replaced the working stack with the
// import form.
test('a dataset whose other endpoint has no assembly is not an option', () => {
  expect(
    getAddRowOptions(
      session([track('hg38_ghost', ['hg38', 'ghost'])], undefined, ['ghost']),
      'hg38',
    ),
  ).toEqual([])
})

test('an unloaded endpoint does not hide the datasets either side of it', () => {
  const options = getAddRowOptions(
    session(
      [
        track('hg38_ghost', ['hg38', 'ghost']),
        track('hg38_mm39', ['hg38', 'mm39']),
      ],
      undefined,
      ['ghost'],
    ),
    'hg38',
  )
  expect(options).toEqual([
    { trackId: 'hg38_mm39', name: 'hg38_mm39', newAssembly: 'mm39' },
  ])
})

// its one endpoint is the terminal row's own assembly, which is live by
// construction, so the filter above must not take it
test('a self-alignment survives the loaded-assembly filter', () => {
  expect(
    getAddRowOptions(
      session([track('hg38_self', ['hg38', 'hg38'])], undefined, ['ghost']),
      'hg38',
    ),
  ).toEqual([{ trackId: 'hg38_self', name: 'hg38_self', newAssembly: 'hg38' }])
})

// the terminal row names the assembly canonically while the dataset names an
// alias of it; the option must still appear, and must offer the other endpoint
// under the name the rest of the form uses
test('a dataset naming an alias of the terminal assembly is an option', () => {
  expect(
    getAddRowOptions(session([track('aliased', ['hg19', 'mm39'])]), 'hg38'),
  ).toEqual([{ trackId: 'aliased', name: 'aliased', newAssembly: 'mm39' }])
})
