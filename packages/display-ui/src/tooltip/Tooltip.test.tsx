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

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The delay is the whole reason this is not a `title` attribute's one-second
// wait, so it is worth an assertion of its own rather than being fast-forwarded
// past everywhere.
test('a hover raises the bubble only after the enter delay', async () => {
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
})

test('leaving before the delay elapses raises nothing', () => {
  render(<Subject />)
  const button = screen.getByRole('button')

  hover(button)
  fireEvent.pointerLeave(button)
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('keyboard focus skips the delay, and blur takes it down', async () => {
  render(<Subject />)
  const button = screen.getByRole('button')

  fireEvent.focus(button)
  expect(await screen.findByRole('tooltip')).toBeTruthy()

  fireEvent.blur(button)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

// Escape is the dismissal a pointer leaving cannot cover: a tooltip raised by
// focus stays up until the focus moves, and a bubble over the thing being read
// is in the way.
test('escape dismisses a tooltip raised by focus', async () => {
  render(<Subject />)
  fireEvent.focus(screen.getByRole('button'))
  expect(await screen.findByRole('tooltip')).toBeTruthy()

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

// The press answers "what is this?", so a label still hanging over the control
// that just did something reads as stuck.
test('pressing the trigger takes the bubble down', async () => {
  render(<Subject />)
  const button = screen.getByRole('button')

  fireEvent.focus(button)
  expect(await screen.findByRole('tooltip')).toBeTruthy()

  fireEvent.pointerDown(button)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

// A touch "hover" is the press that is also about to be a click. Touch users
// get the `aria-label` the control carries, not a bubble over the thing their
// finger is on.
test('a touch pointer raises nothing', () => {
  render(<Subject />)
  fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'touch' })
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('an empty title raises nothing', () => {
  render(<Subject title="" />)
  hover(screen.getByRole('button'))
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('tooltip')).toBeNull()
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
})

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
