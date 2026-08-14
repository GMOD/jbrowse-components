import { render } from '@testing-library/react'

import { readCrashedSession } from '../crashedSession.ts'
import LoaderWrapper from './Loader.tsx'

// The app under the boundary, replaced by something that throws where the real
// one renders. A throw in the FIRST render means React never commits, so
// useLoaderLifecycle's effect never runs and no config is ever fetched — which
// is why this test needs no network at all.
jest.mock('./Renderer.tsx', () => ({
  __esModule: true,
  default: () => {
    throw new Error('the app exploded')
  },
}))

jest.mock('../makeWorkerInstance', () => () => {})

const setSearch = (qs: string) => {
  window.history.replaceState(null, '', `${window.location.pathname}${qs}`)
}

beforeEach(() => {
  sessionStorage.clear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

// The wiring the whole rung hangs off: reaching FatalErrorDialog has to leave
// behind the id of the session it was showing, or the dialog's Refresh restores
// that same session and crashes again.
test('a crash to the app boundary marks the session the URL names', () => {
  setSearch('?config=test.json&session=local-abcdefg')

  const { getByTestId } = render(<LoaderWrapper initialTimestamp={1} />)

  // the dialog is up, and the marker was written on the way to it
  expect(getByTestId('fatal-error')).toBeTruthy()
  expect(readCrashedSession()).toMatchObject({
    id: 'abcdefg',
    message: 'Error: the app exploded',
  })
})

// A boot with nothing to restore cannot be walked back into, so there is
// nothing for a marker to name. Config failures have their own ladder
// (LoaderErrorBanner's "Start over without URL options") and must not pick up a
// session offer they have no session for.
test('a crash with no local session in the URL marks nothing', () => {
  setSearch('?config=test.json')

  const { getByTestId } = render(<LoaderWrapper initialTimestamp={1} />)

  expect(getByTestId('fatal-error')).toBeTruthy()
  expect(readCrashedSession()).toBeUndefined()
})
