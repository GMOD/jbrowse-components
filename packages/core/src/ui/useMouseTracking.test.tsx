import { act, fireEvent, render, screen } from '@testing-library/react'

import { useMouseState, useMouseTracking } from './useMouseTracking.ts'

let frames: FrameRequestCallback[] = []
const realRaf = window.requestAnimationFrame

beforeEach(() => {
  frames = []
  window.requestAnimationFrame = cb => frames.push(cb)
})

afterEach(() => {
  window.requestAnimationFrame = realRaf
})

function flushFrames() {
  const pending = frames
  frames = []
  act(() => {
    for (const cb of pending) {
      cb(0)
    }
  })
}

function Pointer({
  tracker,
}: {
  tracker: ReturnType<typeof useMouseTracking>['mouseTracker']
}) {
  const state = useMouseState(tracker)
  return <div data-testid="pointer">{state ? `${state.x},${state.y}` : ''}</div>
}

function Display() {
  const { mouseTracker, handleMouseMove, handleMouseLeave } = useMouseTracking()
  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div data-testid="data" />
      <div data-testid="seam" data-resize-handle="true" />
      <Pointer tracker={mouseTracker} />
    </div>
  )
}

test('a move over the data publishes the pointer', () => {
  render(<Display />)
  fireEvent.mouseMove(screen.getByTestId('data'), { clientX: 5, clientY: 7 })
  flushFrames()
  expect(screen.getByTestId('pointer').textContent).toBe('5,7')
})

// a crosshair following the pointer onto a seam rides it as the display
// resizes under it
test('a move onto a resize handle drops the pointer', () => {
  render(<Display />)
  fireEvent.mouseMove(screen.getByTestId('data'), { clientX: 5, clientY: 7 })
  flushFrames()
  fireEvent.mouseMove(screen.getByTestId('seam'), { clientX: 5, clientY: 9 })
  flushFrames()
  expect(screen.getByTestId('pointer').textContent).toBe('')
})
