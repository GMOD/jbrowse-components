import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../../CircularView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addConf(session: ReturnType<typeof createTestSession>) {
  session.addAssemblyConf({
    name: 'volvox',
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

async function setup() {
  const session = createTestSession()
  addConf(session)
  const view = session.addView('CircularView', {
    init: { assembly: 'volvox', tracks: ['sv'] },
  }) as CircularViewModel
  view.setWidth(800)
  await session.assemblyManager.waitForAssembly('volvox')
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
  expect(display.refNameMap).toEqual({ ctgA: 'ctgA' })
  expect(Object.keys(display.blocksForRefs).sort()).toEqual(['ctgA', 'ctgB'])
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

  // synchronous: the autorun runs to its first await as the action ends
  expect(display.features).toBeUndefined()
  expect(display.refNameMap).toBeUndefined()

  await when(() => display.ready)
  expect(display.refNameMap).toEqual({ ctgA: 'ctgA' })
}, 20000)

// After a fetch error every other input of the fetch autorun is unchanged, so
// `reload()`'s pure signal is the only thing that can rewake it. Fails if the
// `reloadCounter` read is deleted from the autorun body, or moved under a gate.
test('reload() rewakes the fetch after an error', async () => {
  const { display } = await setup()

  display.setError(new Error('adapter fell over'))
  display.reload()

  // synchronous: the rewoken autorun cleared the stale halves (which also
  // clears the error) on its way to the first await
  expect(display.error).toBeUndefined()
  expect(display.features).toBeUndefined()

  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
}, 20000)
