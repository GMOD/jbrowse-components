import { Suspense } from 'react'

import { render } from '@testing-library/react'

import { createViewState } from '../index.ts'
import JBrowseCircularGenomeView from './JBrowseCircularGenomeView.tsx'

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
        {
          refName: 'ctgB',
          uniqueId: 'secondId',
          start: 0,
          end: 65,
          seq: 'ACATGCTAGCTACGTGCATGCTCGACATGCATCATCAGCCTGATGCTGATACATGCTAGCTACGT',
        },
      ],
    },
  },
}

const defaultSession = {
  name: 'Test',
  view: {
    id: 'test_view',
    type: 'CircularView',
    displayedRegions: [
      {
        refName: 'ctgA',
        start: 0,
        end: 120,
        assemblyName: 'volvox',
      },
      {
        refName: 'ctgB',
        start: 0,
        end: 65,
        assemblyName: 'volvox',
      },
    ],
    tracks: [],
  },
}
beforeEach(() => jest.useFakeTimers())

test('<JBrowseCircularGenomeView />', async () => {
  const state = createViewState({
    assembly,
    tracks: [],
    defaultSession,
  })
  state.session.view.setWidth(800)
  const { container, findAllByText } = render(
    <Suspense fallback={<div>Loading...</div>}>
      <JBrowseCircularGenomeView viewState={state} />
    </Suspense>,
  )
  await findAllByText('ctgA', {}, { timeout: 10000 })

  // xref https://stackoverflow.com/a/64875069/2129219 without this ripples non-deterministically show up in snapshot
  jest.runAllTimers()
  expect(container).toMatchSnapshot()
}, 10000)

test('createViewState with no defaultSession auto-displays the assembly', async () => {
  const state = createViewState({ assembly, tracks: [] })
  // with no session, createViewState seeds view.init to draw the whole assembly
  expect(state.session.view.init).toEqual({ assembly: 'volvox' })
  state.session.view.setWidth(800)
  const { findAllByText } = render(
    <Suspense fallback={<div>Loading...</div>}>
      <JBrowseCircularGenomeView viewState={state} />
    </Suspense>,
  )
  await findAllByText('ctgA', {}, { timeout: 10000 })

  // init drove the displayed regions, then cleared itself
  jest.runAllTimers()
  expect(state.session.view.init).toBeUndefined()
  expect(state.session.view.displayedRegions.length).toBe(2)
}, 10000)

test('config internetAccounts are auto-initialized via the shared mixin', () => {
  const state = createViewState({
    assembly,
    tracks: [],
    internetAccounts: [
      {
        type: 'HTTPBasicInternetAccount',
        internetAccountId: 'basic1',
        name: 'basic auth',
      },
    ],
  })
  const account = state.internetAccounts.find(
    a => a.internetAccountId === 'basic1',
  )
  expect(account?.type).toBe('HTTPBasicInternetAccount')
})
