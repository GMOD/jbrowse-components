import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { showSearchResults } from '../../searchUtils.ts'
import SearchResultsDialog from './SearchResultsDialog.tsx'

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
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'eden',
          refName: 'ctgA',
          start: 99,
          end: 200,
          name: 'EDEN',
        },
      ],
    },
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
  const { model } = await setup()
  const moved = await showSearchResults({
    results: hits,
    query: 'EDEN',
    model,
    assemblyName: 'volvox',
    showHitTrack,
  })
  expect(moved).toBe(false)
  render(<SearchResultsDialog model={model} />)
  fireEvent.click((await screen.findAllByText('Go'))[0]!)
  await waitFor(() => {
    expect(model.displayedRegions.length).toBe(1)
  })
  return model
}

const trackIds = (model: {
  tracks: { configuration: { trackId: string } }[]
}) => model.tracks.map(t => t.configuration.trackId)

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

test('picking a hit closes the picker', async () => {
  const { model } = await setup()
  await showSearchResults({
    results: hits,
    query: 'EDEN',
    model,
    assemblyName: 'volvox',
  })
  expect(model.searchPicker?.rows).toHaveLength(2)
  await model.searchPicker.pick(model.searchPicker.rows[0].id)
  expect(model.searchPicker).toBeUndefined()
})

test('a hit that fails to land is reported and still closes the picker', async () => {
  const { session, model } = await setup()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  model.setSearchResults(hits, 'EDEN', 'volvox', () =>
    Promise.reject(new Error('no such track')),
  )
  await model.searchPicker.pick(hits[0]!.getId())
  expect(model.searchPicker).toBeUndefined()
  expect(session.snackbarMessages.at(-1)?.message).toContain('no such track')
})

test('hits in a track the view already shows come first', async () => {
  const { model } = await setup()
  await model.launchTrack('genes')
  const elsewhere = new BaseResult({
    label: 'EDEN',
    locString: 'ctgA:700..800',
    trackId: 'not_in_view',
  })
  model.setSearchResults([elsewhere, ...hits], 'EDEN', 'volvox')
  expect(
    model.searchPicker?.rows.map((r: { trackName: string }) => r.trackName),
  ).toEqual(['genes', 'genes', ''])
})

test('a pick that settles after a newer search leaves the newer picker open', async () => {
  const { model } = await setup()
  let settle = () => {}
  model.setSearchResults(
    hits,
    'EDEN',
    'volvox',
    () => new Promise<void>(resolve => (settle = resolve)),
  )
  const slow = model.searchPicker.pick(hits[0]!.getId())
  model.setSearchResults(hits, 'EDEN again', 'volvox')
  settle()
  await slow
  expect(model.searchPicker?.query).toBe('EDEN again')
})

test('a new search closes the picker the last one raised', async () => {
  const { model } = await setup()
  model.setSearchResults(hits, 'EDEN', 'volvox')
  await model.navToLocString('ctgA:1..100', 'volvox')
  expect(model.searchPicker).toBeUndefined()
})

test('view.search hands back the rows the picker would list, and a pick lands', async () => {
  const { model } = await setup()
  await model.navToLocString('ctgA:1..100', 'volvox')
  const found = await model.search('ctgA')
  expect(found.rows.map((r: { label: string }) => r.label)).toEqual(['ctgA'])
  await model.navToLocString('ctgA:500..600', 'volvox')
  const before = model.bpPerPx
  await found.pick(found.rows[0].id)
  expect(model.searchPicker).toBeUndefined()
  expect(model.bpPerPx).toBeGreaterThan(before)
})

test('a long list can be narrowed, and Enter lands on the one row left', async () => {
  const { model } = await setup()
  const many = Array.from(
    { length: 12 },
    (_, i) =>
      new BaseResult({
        label: `HOXA${i + 1}`,
        locString: `ctgA:${i * 50 + 1}..${i * 50 + 20}`,
        trackId: 'genes',
      }),
  )
  model.setSearchResults(many, 'HOXA', 'volvox')
  render(<SearchResultsDialog model={model} />)
  await screen.findByText('12 matches for')
  const filter = screen.getByPlaceholderText(
    'Filter by name, location or track',
  )
  fireEvent.change(filter, { target: { value: 'hoxa1' } })
  // HOXA1, HOXA10, HOXA11, HOXA12
  expect(screen.getAllByText('Go')).toHaveLength(4)
  fireEvent.change(filter, { target: { value: 'hoxa11' } })
  expect(screen.getAllByText('Go')).toHaveLength(1)
  fireEvent.keyDown(filter, { key: 'Enter' })
  await waitFor(() => {
    expect(model.searchPicker).toBeUndefined()
  })
  expect(model.displayedRegions[0]?.refName).toBe('ctgA')
})

test('a short list shows no filter', async () => {
  const { model } = await setup()
  model.setSearchResults(hits, 'EDEN', 'volvox')
  render(<SearchResultsDialog model={model} />)
  await screen.findByText('2 matches for')
  expect(screen.queryByPlaceholderText(/Filter/)).toBeNull()
})
