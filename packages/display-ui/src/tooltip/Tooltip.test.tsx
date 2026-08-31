import { act, fireEvent, render, screen } from '@testing-library/react'

import Tooltip from './Tooltip.tsx'

// The bubble arrives through `lazy(() => import('./TooltipBubble.tsx'))`, so
// every assertion that it appeared has to await the chunk — `findBy`, not
// `getBy`. That lazy boundary is load-bearing (see eagerBoundary.test.ts), so a
// test written against a synchronous bubble would be pinning the wrong shape.

function Subject({ title = 'Hide legend' }: { title?: string } = {}) {
  return (
    <Tooltip title={title}>
      <button type="button" aria-label="Hide legend">
        ×
      </button>
    </Tooltip>
  )
}

function hover(el: HTMLElement) {
  fireEvent.pointerEnter(el, { pointerType: 'mouse' })
}

// A no-op once a test's own `jest.useRealTimers()` already ran; the net is for
// the test that throws before reaching it, which would otherwise leave fake
// timers armed for whatever runs next in this file.
afterEach(() => {
  jest.useRealTimers()
})

// Fake timers are scoped to the tests below that actually drive
// `ENTER_DELAY_MS`, not applied file-wide: `@testing-library/dom`'s `waitFor`
// detects a fake-timer environment and switches from its normal
// MutationObserver-based poll to a busy loop of `jest.advanceTimersByTime`
// calls, each wrapped in its own `act()` — real work, on the real clock, for
// every `findByRole` in the file whether or not that test ever advances a
// timer. The tests below that trigger through focus (which skips the delay
// entirely, see `useTooltip`) have nothing for fake timers to control, so on
// real timers `findByRole` takes the cheaper MutationObserver path instead —
// this is the distinction
// https://github.com/testing-library/dom-testing-library/issues/830 warns
// about.
//
// A `findByRole` still crosses the `lazy()` boundary at the top of
// useTooltip.tsx — a real dynamic import, a real microtask, a real
// React-scheduled retry render — so it is not free even on the fast path, and
// on a busy machine it can outrun the suite's default 15s. The explicit
// timeout on each one below is real cross-boundary async work getting
// headroom, not a hung test — same idea as the `40000`/`60000` already used
// elsewhere in this repo for a view mount (e.g.
// `JBrowseLinearGenomeView.test.tsx`, `products/jbrowse-img`).

// The delay is the whole reason this is not a `title` attribute's one-second
// wait, so it is worth an assertion of its own rather than being fast-forwarded
// past everywhere.
test('a hover raises the bubble only after the enter delay', async () => {
  jest.useFakeTimers()
  render(<Subject />)
  const button = screen.getByRole('button')

  hover(button)
  act(() => {
    jest.advanceTimersByTime(200)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()

  act(() => {
    jest.advanceTimersByTime(400)
  })
  expect((await screen.findByRole('tooltip')).textContent).toBe('Hide legend')
  jest.useRealTimers()
}, 60000)

test('leaving before the delay elapses raises nothing', () => {
  jest.useFakeTimers()
  render(<Subject />)
  const button = screen.getByRole('button')

  hover(button)
  fireEvent.pointerLeave(button)
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
  jest.useRealTimers()
})

test('keyboard focus skips the delay, and blur takes it down', async () => {
  render(<Subject />)
  const button = screen.getByRole('button')

  fireEvent.focus(button)
  expect(await screen.findByRole('tooltip')).toBeTruthy()

  fireEvent.blur(button)
  expect(screen.queryByRole('tooltip')).toBeNull()
}, 60000)

// Escape is the dismissal a pointer leaving cannot cover: a tooltip raised by
// focus stays up until the focus moves, and a bubble over the thing being read
// is in the way.
test('escape dismisses a tooltip raised by focus', async () => {
  render(<Subject />)
  fireEvent.focus(screen.getByRole('button'))
  expect(await screen.findByRole('tooltip')).toBeTruthy()

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
}, 60000)

// The press answers "what is this?", so a label still hanging over the control
// that just did something reads as stuck.
test('pressing the trigger takes the bubble down', async () => {
  render(<Subject />)
  const button = screen.getByRole('button')

  fireEvent.focus(button)
  expect(await screen.findByRole('tooltip')).toBeTruthy()

  fireEvent.pointerDown(button)
  expect(screen.queryByRole('tooltip')).toBeNull()
}, 60000)

// A touch "hover" is the press that is also about to be a click. Touch users
// get the `aria-label` the control carries, not a bubble over the thing their
// finger is on.
test('a touch pointer raises nothing', () => {
  jest.useFakeTimers()
  render(<Subject />)
  fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'touch' })
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
  jest.useRealTimers()
})

test('an empty title raises nothing', () => {
  jest.useFakeTimers()
  render(<Subject title="" />)
  hover(screen.getByRole('button'))
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
  jest.useRealTimers()
})

// `aria-describedby` and never `aria-label`: the control's own name has to
// stand on its own, because the node this points at exists only during a hover.
test('the trigger describes itself by the bubble, and keeps its own name', async () => {
  render(<Subject />)
  const button = screen.getByRole('button')
  expect(button.getAttribute('aria-describedby')).toBeNull()

  fireEvent.focus(button)
  const tip = await screen.findByRole('tooltip')
  expect(button.getAttribute('aria-describedby')).toBe(tip.id)
  expect(button.getAttribute('aria-label')).toBe('Hide legend')
}, 60000)

// cloneElement over a wrapper element, so the trigger's own handlers have to
// survive rather than be replaced — these controls are absolutely positioned
// inside a legend, where an extra `<span>` moves them.
test("the child's own handlers still fire", () => {
  const onClick = jest.fn()
  const onFocus = jest.fn()
  render(
    <Tooltip title="Hide legend">
      <button
        type="button"
        aria-label="Hide legend"
        onClick={onClick}
        onFocus={onFocus}
      >
        ×
      </button>
    </Tooltip>,
  )
  const button = screen.getByRole('button')
  fireEvent.focus(button)
  fireEvent.click(button)
  expect(onFocus).toHaveBeenCalled()
  expect(onClick).toHaveBeenCalled()
})
