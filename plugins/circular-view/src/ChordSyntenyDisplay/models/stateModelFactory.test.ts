import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../../CircularView/model.ts'
import type { Slice } from '../../CircularView/slices.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addAssemblyConf(
  session: ReturnType<typeof createTestSession>,
  name: string,
) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: ['ctgA', 'ctgB'].map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        })),
      },
    },
  })
}

function addTrackConf(
  session: ReturnType<typeof createTestSession>,
  assemblyNames: string[],
) {
  const [query, target] = assemblyNames as [string, string]
  session.addSessionTrackConf({
    trackId: 'aln',
    type: 'SyntenyTrack',
    name: 'my alignments',
    assemblyNames,
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'aln1',
          assemblyName: query,
          refName: 'ctgA',
          start: 100,
          end: 200,
          strand: -1,
          mate: {
            assemblyName: target,
            refName: 'ctgB',
            start: 1000,
            end: 1100,
          },
        },
      ],
    },
  })
}

function assemblyOf(slice: Slice | undefined) {
  const region = slice?.region
  if (!region) {
    return undefined
  }
  return region.elided ? region.regions[0]!.assemblyName : region.assemblyName
}

async function setup(assemblyNames: string[]) {
  const session = createTestSession()
  for (const name of new Set(assemblyNames)) {
    addAssemblyConf(session, name)
  }
  addTrackConf(session, assemblyNames)
  const view = (await session.launchView('CircularView', {
    assembly: [...new Set(assemblyNames)],
    tracks: ['aln'],
  })) as CircularViewModel
  view.setWidth(800)
  for (const name of new Set(assemblyNames)) {
    await session.assemblyManager.waitForAssembly(name)
  }
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  return { session, view, display }
}

test('a self-alignment places both ends on the one assembly', async () => {
  const { display } = await setup(['volvox', 'volvox'])
  expect(display.type).toBe('ChordSyntenyDisplay')
  expect(display.features).toHaveLength(1)
  const feature = display.features[0]!
  expect(assemblyOf(display.sliceFor('volvox', 'ctgA'))).toBe('volvox')
  expect(
    assemblyOf(display.sliceFor(feature.get('assemblyName'), 'ctgB')),
  ).toBe('volvox')
}, 20000)

// The reason the index is keyed by assembly as well as refName: each of these
// assemblies has a ctgA and a ctgB, so a refName-keyed table would answer
// whichever slice it wrote last and draw both ends on one genome. Compared by
// what the slice IS rather than by identity — `staticSlices` is an unobserved
// computed, so it hands back fresh Slice objects on every read.
test('two assemblies keep their own contigs of the same name', async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  expect(view.assemblyNames).toEqual(['volvox', 'volvox2'])
  expect(assemblyOf(display.sliceFor('volvox', 'ctgA'))).toBe('volvox')
  expect(assemblyOf(display.sliceFor('volvox2', 'ctgA'))).toBe('volvox2')
}, 20000)

test('reload() rewakes the fetch after an error', async () => {
  const { display } = await setup(['volvox', 'volvox'])

  display.setError(new Error('adapter fell over'))
  expect(display.displayPhase).toBe('error')
  display.reload()

  await when(() => display.error === undefined)
  expect(display.features).toBeUndefined()

  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
}, 20000)
