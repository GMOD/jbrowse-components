import { getAddRowOptions } from './syntenyTracks.ts'

import type { LevelAbove } from './syntenyTracks.ts'
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

// what the dialog puts in front of the user: the assembly each option adds, and
// the dataset that would draw it
const offered = (
  sess: AbstractSessionModel,
  terminalAssembly: string,
  levelAbove?: LevelAbove,
) =>
  getAddRowOptions({ session: sess, terminalAssembly, levelAbove }).options.map(
    o => `${o.name} -> ${o.newAssembly}`,
  )

test('each endpoint a dataset reaches is one option', () => {
  const { options } = getAddRowOptions({
    session: session([
      track('hg38_mm39', ['hg38', 'mm39']),
      track('hg38_rn7', ['hg38', 'rn7']),
    ]),
    terminalAssembly: 'hg38',
  })
  expect(options).toEqual([
    {
      id: '["hg38_mm39","mm39"]',
      trackId: 'hg38_mm39',
      name: 'hg38_mm39',
      newAssembly: 'mm39',
    },
    {
      id: '["hg38_rn7","rn7"]',
      trackId: 'hg38_rn7',
      name: 'hg38_rn7',
      newAssembly: 'rn7',
    },
  ])
})

// a dataset spanning three assemblies reaches two new rows, and picking it is
// not enough to say which — so it is two options, not one
test('a multiway dataset offers each of its far endpoints', () => {
  expect(offered(session([track('three', ['hg38', 'mm39', 'rn7'])]), 'hg38')) //
    .toEqual(['three -> mm39', 'three -> rn7'])
})

test('a dataset not referencing the terminal assembly is not an option', () => {
  expect(offered(session([track('a_b', ['a', 'b'])]), 'hg38')).toEqual([])
})

test('a connection dataset can extend the stack too', () => {
  // connections hold their tracks outside session.tracks
  expect(
    offered(session([], [track('hub_track', ['hg38', 'mm39'])]), 'hg38'),
  ).toEqual(['hub_track -> mm39'])
})

test('a self-alignment dataset adds the same assembly again', () => {
  // both endpoints are the terminal assembly, so there is no other one to find
  expect(offered(session([track('hg38_self', ['hg38', 'hg38'])]), 'hg38')) //
    .toEqual(['hg38_self -> hg38'])
})

// Not a broken row but a broken view: the row's init fails with "Assembly X
// not found", which sets the whole synteny view's error, and showImportForm
// reads that error — so an offered option replaced the working stack with the
// import form.
test('a dataset whose other endpoint has no assembly is not an option', () => {
  expect(
    offered(
      session([track('hg38_ghost', ['hg38', 'ghost'])], undefined, ['ghost']),
      'hg38',
    ),
  ).toEqual([])
})

test('an unloaded endpoint does not hide the datasets either side of it', () => {
  expect(
    offered(
      session(
        [
          track('hg38_ghost', ['hg38', 'ghost']),
          track('hg38_mm39', ['hg38', 'mm39']),
        ],
        undefined,
        ['ghost'],
      ),
      'hg38',
    ),
  ).toEqual(['hg38_mm39 -> mm39'])
})

// its one endpoint is the terminal row's own assembly, which is live by
// construction, so the filter above must not take it
test('a self-alignment survives the loaded-assembly filter', () => {
  expect(
    offered(
      session([track('hg38_self', ['hg38', 'hg38'])], undefined, ['ghost']),
      'hg38',
    ),
  ).toEqual(['hg38_self -> hg38'])
})

// the terminal row names the assembly canonically while the dataset names an
// alias of it; the option must still appear, and must offer the other endpoint
// under the name the rest of the form uses
test('a dataset naming an alias of the terminal assembly is an option', () => {
  expect(
    offered(session([track('aliased', ['hg19', 'mm39'])]), 'hg38'),
  ).toEqual(['aliased -> mm39'])
})

// A two-row hg38/mm39 view opened on its own synteny track: that track is the
// only thing connecting the bottom row, and all it can offer is hg38 back
// again — the band above, drawn a second time upside down under it. The dialog
// names it rather than offering it.
test('the dataset already drawn above is not offered back', () => {
  const { options, alreadyDrawn } = getAddRowOptions({
    session: session([track('hg38_mm39', ['hg38', 'mm39'])]),
    terminalAssembly: 'mm39',
    levelAbove: { assembly: 'hg38', trackIds: ['hg38_mm39'] },
  })
  expect(options).toEqual([])
  expect(alreadyDrawn.map(o => o.name)).toEqual(['hg38_mm39'])
})

// an assembly can legitimately appear twice in a stack — two aligners' takes on
// one pair, a band each — so the screen is per dataset, not per assembly
test('a second dataset back to the row above is still offered', () => {
  expect(
    offered(
      session([
        track('minimap2', ['hg38', 'mm39']),
        track('lastz', ['hg38', 'mm39']),
      ]),
      'mm39',
      { assembly: 'hg38', trackIds: ['minimap2'] },
    ),
  ).toEqual(['lastz -> hg38'])
})

test('a dataset drawn above still offers the endpoints it has not drawn', () => {
  expect(
    offered(session([track('three', ['hg38', 'mm39', 'rn7'])]), 'mm39', {
      assembly: 'hg38',
      trackIds: ['three'],
    }),
  ).toEqual(['three -> rn7'])
})

// A row builds its assembly names from its displayed regions, so it has none
// until it has navigated. An empty request matches every synteny track (see
// getSyntenyTracks), which is what the whole session's datasets being offered
// under a blank anchor came from.
test('a row with no assembly yet reaches no dataset', () => {
  expect(offered(session([track('hg38_mm39', ['hg38', 'mm39'])]), '')).toEqual(
    [],
  )
})
