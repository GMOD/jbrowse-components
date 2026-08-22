import { render, waitFor } from '@testing-library/react'

import { createViewState } from '../index.ts'
import JBrowseLinearGenomeView from './JBrowseLinearGenomeView.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

const timeout = 30000

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 120,
          seq: 'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctg',
        },
      ],
    },
  },
}

const defaultSession = {
  name: 'Test',
  view: {
    id: 'test_view',
    type: 'LinearGenomeView',
    bpPerPx: 0.05,
    displayedRegions: [
      {
        refName: 'ctgA',
        start: 0,
        end: 120,
        reversed: false,
        assemblyName: 'volvox',
      },
    ],
    tracks: [
      {
        type: 'ReferenceSequenceTrack',
        configuration: 'volvox_refseq',
        displays: [
          {
            type: 'LinearReferenceSequenceDisplay',
            configuration: 'volvox_refseq-LinearReferenceSequenceDisplay',
          },
        ],
      },
    ],
  },
}

test('<JBrowseLinearGenomeView /> renders successfully', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    defaultSession,
  })
  const { getAllByTestId, getByPlaceholderText } = render(
    <JBrowseLinearGenomeView viewState={state} />,
  )

  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value
  await waitFor(
    () => {
      expect(getAllByTestId('sequence-display').length).toBe(1)
    },
    {
      timeout,
    },
  )
  await waitFor(
    () => {
      expect(getInputValue()).toBe('ctgA:1..40')
    },
    { timeout },
  )
}, 40000)

test('top-level location + highlight navigate via init', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    location: 'ctgA:1-40',
    highlight: ['ctgA:5-10'],
  })
  const { getByPlaceholderText } = render(
    <JBrowseLinearGenomeView viewState={state} />,
  )
  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value
  await waitFor(
    () => {
      expect(getInputValue()).toBe('ctgA:1..40')
    },
    { timeout },
  )
  // init consumes highlight and backfills assemblyName, then clears itself
  await waitFor(
    () => {
      expect(state.session.view.init).toBeUndefined()
    },
    { timeout },
  )
  expect(state.session.view.highlight).toEqual([
    expect.objectContaining({
      refName: 'ctgA',
      start: 4,
      end: 10,
      assemblyName: 'volvox',
    }),
  ])
}, 40000)

// This product rendered no Snackbar until 2026-08, so every `session.notify` /
// `notifyError` went into `snackbarMessages` and stayed there. That is the
// quietest failure shape available: `showTrack` with an id that isn't in the
// config returns `undefined` rather than throwing, so the embed showed a track
// that simply never appeared and the reason existed only in memory.
//
// Asserted through a real failing call rather than by pushing a message
// directly, because the message arriving is only half of what regressed -- the
// other half is that this path reports at all.
test('a failure the session survives reaches the screen', async () => {
  const state = createViewState({ assembly, tracks: [], defaultSession })
  const { findByText } = render(<JBrowseLinearGenomeView viewState={state} />)

  expect(state.session.view.showTrack('not_a_track_in_this_config')).toBe(
    undefined,
  )

  expect(
    await findByText(
      /Could not resolve identifier "not_a_track_in_this_config"/,
      undefined,
      {
        timeout,
      },
    ),
  ).toBeTruthy()
}, 40000)

// Two things at once, because they are the same fact from both sides. Given no
// height the component is content-height -- nothing above it has a height, so
// `height: 100%` down the chain resolves to auto -- and the host's own box is
// what bounds it. Then `drawerViewHeight` bounds it after all, and the box that
// clamp applies to is `overflow: hidden` with no scrollable ancestor: before
// this, a track set taller than the clamp had nothing below the fold reachable.
test('unbounded until a drawer opens, and then the box scrolls', async () => {
  const state = createViewState({ assembly, tracks: [], defaultSession })
  const { findByTestId } = render(<JBrowseLinearGenomeView viewState={state} />)

  const box = await findByTestId('embedded-view-box')
  expect(box.parentElement?.style.height).toBe('')
  expect(box.style.overflowY).toBe('')

  state.session.view.activateTrackSelector()

  await waitFor(
    () => {
      expect(box.parentElement?.style.height).toBe('100vh')
      expect(box.style.overflowY).toBe('auto')
    },
    { timeout },
  )
}, 40000)

// `height` is what `drawerViewHeight` was reaching for: a drawer needs the view
// beside it to be tall against something, and before this the only number that
// did that arrived with a condition attached. So it applies with no drawer open,
// and it wins over the older name when a host passes both.
test('a height bounds the view with no drawer, and outranks drawerViewHeight', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    defaultSession,
    height: '400px',
    drawerViewHeight: '100vh',
  })
  const { findByTestId } = render(<JBrowseLinearGenomeView viewState={state} />)

  const box = await findByTestId('embedded-view-box')
  expect(box.parentElement?.style.height).toBe('400px')
  expect(box.style.overflowY).toBe('auto')

  state.session.view.activateTrackSelector()

  await waitFor(
    () => {
      expect(state.session.visibleWidget).toBeTruthy()
    },
    { timeout },
  )
  expect(box.parentElement?.style.height).toBe('400px')
}, 40000)
