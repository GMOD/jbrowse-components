import { act, render, screen } from '@testing-library/react'

import {
  deleteQueryParams,
  setQueryParams,
  useQueryParam,
} from './queryParams.ts'

// The Loader reads what to open (?config=, ?specLink=) out of the query string
// and clears it once the session is up or the load failed. history.replaceState
// fires no event, so these pin that a write still reaches the readers — without
// that, a failed config load left the app on "Loading session" forever because
// the setConfig(undefined) that was supposed to drop it to the start screen
// re-rendered nothing.

let setConfig: (v: string | undefined) => void = () => {}
let renderCount = 0

function Probe() {
  const [config, setValue] = useQueryParam('config')
  setConfig = setValue
  renderCount++
  return <div data-testid="value">{config ?? 'none'}</div>
}

beforeEach(() => {
  renderCount = 0
  window.history.replaceState(null, '', '/')
})

test('reads the current value of its param', () => {
  window.history.replaceState(null, '', '/?config=/tmp/session.jbrowse')
  render(<Probe />)
  expect(screen.getByTestId('value').textContent).toBe('/tmp/session.jbrowse')
})

test('clearing a param re-renders the reader', () => {
  window.history.replaceState(null, '', '/?config=/tmp/session.jbrowse')
  render(<Probe />)
  act(() => {
    setConfig(undefined)
  })
  expect(screen.getByTestId('value').textContent).toBe('none')
  expect(window.location.search).toBe('')
})

test('setting a param re-renders the reader', () => {
  render(<Probe />)
  act(() => {
    setConfig('/tmp/other.jbrowse')
  })
  expect(screen.getByTestId('value').textContent).toBe('/tmp/other.jbrowse')
})

test('a param another reader owns does not re-render this one', () => {
  window.history.replaceState(null, '', '/?config=a&other=b')
  render(<Probe />)
  const before = renderCount
  act(() => {
    setQueryParams({ other: 'c' })
  })
  // useSyncExternalStore is notified but the snapshot for 'config' is
  // unchanged, so React bails out rather than re-rendering every reader
  expect(renderCount).toBe(before)
  expect(screen.getByTestId('value').textContent).toBe('a')
})

test('deleteQueryParams re-renders the reader', () => {
  window.history.replaceState(null, '', '/?config=a')
  render(<Probe />)
  act(() => {
    deleteQueryParams(['config'])
  })
  expect(screen.getByTestId('value').textContent).toBe('none')
})

test('unsubscribes on unmount', () => {
  window.history.replaceState(null, '', '/?config=a')
  const { unmount } = render(<Probe />)
  unmount()
  const before = renderCount
  act(() => {
    setQueryParams({ config: 'b' })
  })
  expect(renderCount).toBe(before)
})
