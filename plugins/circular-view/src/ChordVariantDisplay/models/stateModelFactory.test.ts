import { setConf } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { navToLoc } from '@jbrowse/sv-core'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../../CircularView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addConf(
  session: ReturnType<typeof createTestSession>,
  assemblies = ['volvox'],
) {
  for (const name of assemblies) {
    session.addAssemblyConf({
      name,
      sequence: {
        trackId: `${name}_refseq`,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'FromConfigSequenceAdapter',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'ctgA',
              start: 0,
              end: 16000,
              seq: 'a'.repeat(16000),
            },
            {
              refName: 'ctgB',
              uniqueId: 'ctgB',
              start: 0,
              end: 8000,
              seq: 'a'.repeat(8000),
            },
          ],
        },
      },
    })
  }
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    name: 'my svs',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'sv1',
          refName: 'ctgA',
          start: 100,
          end: 200,
          mate: { refName: 'ctgB', start: 1000, end: 1100 },
        },
      ],
    },
  })
}

async function setup(assemblies = ['volvox']) {
  const session = createTestSession()
  addConf(session, assemblies)
  const view = (await session.launchView('CircularView', {
    assembly: assemblies,
    tracks: ['sv'],
  })) as CircularViewModel
  view.setWidth(800)
  for (const name of assemblies) {
    await session.assemblyManager.waitForAssembly(name)
  }
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  return { session, view, display }
}

test('a ready display places both ends of its chords', async () => {
  const { display } = await setup()
  expect(display.features).toHaveLength(1)
  expect(display.sliceFor(undefined, 'ctgA')?.region.refName).toBe('ctgA')
  expect(display.sliceFor(undefined, 'ctgB')?.region.refName).toBe('ctgB')
}, 20000)

test('clicking a chord selects the record and opens its details', async () => {
  const { session, display } = await setup()
  display.onChordClick(display.features[0])
  expect(session.selection).toBe(display.features[0])
  expect(session.widgets.get('variantFeature')?.type).toBe(
    'VariantFeatureWidget',
  )
}, 20000)

// the circle cannot navigate to a locus, so the details panel's link opens one
test("the details panel's zoom link opens the locus in a linear view", async () => {
  const { session, view, display } = await setup()
  display.onChordClick(display.features[0])
  navToLoc('ctgA:101-200', session.widgets.get('variantFeature'))
  const linear = session.views.find(v => v.id === `${view.id}-linear`)
  expect(linear?.type).toBe('LinearGenomeView')
}, 20000)

test('an onChordClick callback runs in place of the details', async () => {
  const { session, display } = await setup()
  const clicked: unknown[] = []
  getEnv(session).pluginManager.jexl.addFunction(
    'recordChordClick',
    (feature: unknown) => {
      clicked.push(feature)
    },
  )
  setConf(display, 'onChordClick', 'jexl:recordChordClick(feature)')
  display.onChordClick(display.features[0])
  expect(clicked).toHaveLength(1)
  expect(session.widgets.has('variantFeature')).toBe(false)
}, 20000)

// A VCF names one genome, and both genomes on the circle carry a ctgA: the
// chords are fetched over, and placed on, the track's own genome's arcs
test('a one-genome variant track on a two-genome circle keeps to its genome', async () => {
  const { display } = await setup(['volvox', 'volvox2'])
  expect(display.trackAssemblyNames).toEqual(['volvox'])
  expect(display.features).toHaveLength(1)
  expect(display.sliceFor(undefined, 'ctgB')?.region.assemblyName).toBe(
    'volvox',
  )
}, 20000)

// `ready` is this display's whole freshness answer, so the old features must
// not outlive a region change into the new layout
test('a region change blanks the features until the refetch lands', async () => {
  const { view, display } = await setup()

  view.setDisplayedRegions([view.displayedRegions[0]!])

  await when(() => display.features === undefined)
  expect(display.displayPhase).toBe('loading')

  await when(() => display.ready)
  expect(display.displayPhase).toBe('ready')
}, 20000)

// After a fetch error every other input of the fetch autorun is unchanged, so
// `reload()`'s pure signal is the only thing that can rewake it. Fails if the
// `reloadCounter` read is deleted from the autorun body, or moved under a gate.
test('reload() rewakes the fetch after an error', async () => {
  const { display } = await setup()

  display.setError(new Error('adapter fell over'))
  expect(display.displayPhase).toBe('error')
  display.reload()
  expect(display.displayPhase).not.toBe('error')

  // the fetch key is unchanged, so only the reload gets past it
  await when(() => display.features === undefined)
  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
}, 20000)

// A caller that writes one record per translocation leaves the mate's contig
// with no record of its own, so the file never names it and the adapter's name
// table has no entry for it
test('a mate on a contig the file holds no record on still finds its slice', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    refNameAliases: {
      adapter: {
        type: 'FromConfigAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
          { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
        ],
      },
    },
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
          {
            refName: 'ctgB',
            uniqueId: 'ctgB',
            start: 0,
            end: 8000,
            seq: 'a'.repeat(8000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'tra1',
          refName: 'A',
          start: 100,
          end: 101,
          mate: { refName: 'B', start: 1000, end: 1001 },
        },
      ],
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: 'volvox',
    tracks: ['sv'],
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
  expect(display.sliceFor(undefined, 'A')?.region.refName).toBe('ctgA')
  expect(display.sliceFor(undefined, 'B')?.region.refName).toBe('ctgB')
}, 20000)
