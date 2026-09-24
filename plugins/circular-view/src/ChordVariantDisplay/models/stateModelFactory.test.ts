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

test('both halves of a chord render land before the display is ready', async () => {
  const { display } = await setup()
  expect(display.features).toHaveLength(1)
  // the adapter names only the refNames its features start on; a slice whose
  // refName the adapter never mentions keys itself under its own name
  expect(display.adapterNames.volvox.refNameMap).toEqual({ ctgA: 'ctgA' })
  expect(display.sliceFor(undefined, 'ctgA')?.region.refName).toBe('ctgA')
  expect(display.sliceFor(undefined, 'ctgB')?.region.refName).toBe('ctgB')
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

// The features and the refName map used to be fetched by two autoruns with
// different dependencies, sharing one `error` slot. A refName map that failed
// to load was then never asked for again, while the next displayedRegions
// change re-ran the feature fetch, whose setFeatures(undefined) cleared the
// error out from under it — leaving the display on its loading hatch forever
// with nothing said. Refetching them together is what makes the failure
// retryable, so pin that they move as one.
test('a region change re-requests the refName map, not just the features', async () => {
  const { view, display } = await setup()

  view.setDisplayedRegions([view.displayedRegions[0]!])

  // the refetch is debounced now that this fetch runs on the shared skeleton,
  // so the blank arrives with the run rather than with the action — and it is
  // both halves, which is the point: `ready` is this display's whole freshness
  // answer, so a stale map left in place would wave a render through
  await when(() => display.adapterNames === undefined)
  expect(display.features).toBeUndefined()
  expect(display.displayPhase).toBe('loading')

  await when(() => display.ready)
  expect(display.adapterNames.volvox.refNameMap).toEqual({ ctgA: 'ctgA' })
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
