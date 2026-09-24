import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { showSearchResults } from '../../searchUtils.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [{ type: 'LinearGenomeView', displayedRegions: [], tracks: [] }],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 1000,
            seq: 'A'.repeat(1000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  // a picker is only ever raised by a search, which waited for this
  await session.assemblyManager.waitForAssembly('volvox')
  return { session, model: session.views[0] }
}

// two hits that disagree about where to go, so the picker is raised
const hits = ['ctgA:100..200', 'ctgA:500..600'].map(
  locString => new BaseResult({ label: 'EDEN', locString, trackId: 'genes' }),
)

async function pickFirst(showHitTrack?: boolean) {
  const { session, model } = await setup()
  const moved = await showSearchResults({
    results: hits,
    query: 'EDEN',
    model,
    assemblyName: 'volvox',
    showHitTrack,
  })
  expect(moved).toBe(false)
  const { DialogComponent, DialogProps } = session
  render(<DialogComponent {...DialogProps} />)
  fireEvent.click((await screen.findAllByText('Go'))[0]!)
  await waitFor(() => {
    expect(model.displayedRegions.length).toBe(1)
  })
  return model
}

const trackIds = (model: { tracks: { configuration: { trackId: string } }[] }) =>
  model.tracks.map(t => t.configuration.trackId)

// a session spec that named its own tracks asks for no hit track, and the
// picker it raised used to open one anyway
test('a picked hit honours the showHitTrack the search was asked with', async () => {
  expect(trackIds(await pickFirst(false))).toEqual([])
})

test('a picked hit shows its track by default', async () => {
  const model = await pickFirst()
  await waitFor(() => {
    expect(trackIds(model)).toEqual(['genes'])
  })
})
