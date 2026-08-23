import { act, fireEvent, render } from '@testing-library/react'

import VerticalScrollbar from './VerticalScrollbar.tsx'

// Same faithful rAF mock the ResizeHandle test uses — the thumb drag coalesces
// its writes through useRafCommit, so nothing commits until a frame runs.
let rafMap = new Map<number, FrameRequestCallback>()
let nextRafId = 1
const realRaf = window.requestAnimationFrame
const realCancel = window.cancelAnimationFrame

beforeEach(() => {
  rafMap = new Map()
  nextRafId = 1
  window.requestAnimationFrame = cb => {
    const id = nextRafId++
    rafMap.set(id, cb)
    return id
  }
  window.cancelAnimationFrame = id => {
    rafMap.delete(id)
  }
})

afterEach(() => {
  window.requestAnimationFrame = realRaf
  window.cancelAnimationFrame = realCancel
})

function flushRaf() {
  const cbs = [...rafMap.values()]
  rafMap = new Map()
  act(() => {
    for (const cb of cbs) {
      cb(0)
    }
  })
}

// 100px viewport over 400px of content: scrollableHeight 300, thumb
// max(20, 100 * 100/400) = 25px tall, so usableTrack is 75px and one px of
// pointer travel is 4px of scroll.
const VIEWPORT = 100
const CONTENT = 400

function setup(scrollTop = 0) {
  const setScrollTop = jest.fn()
  const { container, rerender } = render(
    <VerticalScrollbar
      scrollTop={scrollTop}
      setScrollTop={setScrollTop}
      viewportHeight={VIEWPORT}
      contentHeight={CONTENT}
      controlsId="canvas"
    />,
  )
  const track = container.querySelector<HTMLElement>(
    '[data-testid="vertical-scrollbar"]',
  )
  if (track) {
    // jsdom lays nothing out, and the page-vs-drag decision is made against the
    // track's own box
    track.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
    track.setPointerCapture = () => {}
    track.releasePointerCapture = () => {}
  }
  return { track: track!, setScrollTop, container, rerender }
}

test('renders nothing when the content fits the viewport', () => {
  const { container } = render(
    <VerticalScrollbar
      scrollTop={0}
      setScrollTop={jest.fn()}
      viewportHeight={100}
      contentHeight={100}
      controlsId="canvas"
    />,
  )
  expect(container.innerHTML).toBe('')
})

test('dragging the thumb scrolls, coalesced to one commit per frame', () => {
  const { track, setScrollTop } = setup()
  // press on the thumb (it spans 0..25 at scrollTop 0), then travel 15px
  fireEvent.pointerDown(track, { clientY: 5, pointerId: 1, button: 0 })
  fireEvent.pointerMove(track, { clientY: 10, pointerId: 1 })
  fireEvent.pointerMove(track, { clientY: 20, pointerId: 1 })
  expect(setScrollTop).not.toHaveBeenCalled()

  flushRaf()
  // 15px of travel over a 75px usable track = 20% of 300px of scroll
  expect(setScrollTop).toHaveBeenLastCalledWith(60)
})

test('a press below the thumb pages down by one viewport', () => {
  const { track, setScrollTop } = setup()
  fireEvent.pointerDown(track, { clientY: 90, pointerId: 1, button: 0 })
  expect(setScrollTop).toHaveBeenLastCalledWith(VIEWPORT)
})

// usePointerDrag takes primary presses only. Hand-rolled, this component took
// every button: a right-press on the thumb started a drag that then ran under
// its own context menu, and a right-press on the track paged the scroll.
test.each([
  ['on the thumb', 5],
  ['on the track', 90],
])('a right-press %s does nothing', (_, clientY) => {
  const { track, setScrollTop } = setup()
  fireEvent.pointerDown(track, { clientY, pointerId: 1, button: 2 })
  fireEvent.pointerMove(track, { clientY: clientY + 20, pointerId: 1 })
  flushRaf()
  expect(setScrollTop).not.toHaveBeenCalled()
})

// One drag belongs to one pointer. A second finger landing mid-drag used to
// re-anchor the gesture, so the next move jumped by the gap between the two.
test('a second pointer landing mid-drag does not re-anchor the drag', () => {
  const { track, setScrollTop } = setup()
  fireEvent.pointerDown(track, { clientY: 5, pointerId: 1, button: 0 })
  fireEvent.pointerDown(track, { clientY: 60, pointerId: 2, button: 0 })
  // the second pointer's move is ignored entirely
  fireEvent.pointerMove(track, { clientY: 80, pointerId: 2 })
  flushRaf()
  expect(setScrollTop).not.toHaveBeenCalled()

  // and the first pointer still measures from where IT went down
  fireEvent.pointerMove(track, { clientY: 20, pointerId: 1 })
  flushRaf()
  expect(setScrollTop).toHaveBeenLastCalledWith(60)
})

test('pointer-up flushes the resting position exactly', () => {
  const { track, setScrollTop } = setup()
  fireEvent.pointerDown(track, { clientY: 5, pointerId: 1, button: 0 })
  fireEvent.pointerMove(track, { clientY: 20, pointerId: 1 })
  fireEvent.pointerUp(track, { clientY: 20, pointerId: 1 })
  // no frame ran, yet the final absolute target has landed
  expect(setScrollTop).toHaveBeenLastCalledWith(60)

  // and the drag is over: a later move is not a drag
  setScrollTop.mockClear()
  fireEvent.pointerMove(track, { clientY: 40, pointerId: 1 })
  flushRaf()
  expect(setScrollTop).not.toHaveBeenCalled()
})

// The track carries `data-gesture-owner`, which is how a display's panel wheel
// handler knows to leave its overlays' own gestures alone. The scrollbar binds
// that same handler to that same marked element, so the marker has to mean "an
// owner INSIDE the panel", not "this element" — otherwise the one control whose
// whole job is scrolling the panel is the one that cannot.
test('a wheel over the track scrolls the panel and never reaches the view', () => {
  const { track, setScrollTop } = setup()
  const e = new WheelEvent('wheel', {
    deltaY: 50,
    bubbles: true,
    cancelable: true,
  })
  const bubbled = jest.fn()
  document.addEventListener('wheel', bubbled)
  act(() => {
    track.dispatchEvent(e)
  })
  document.removeEventListener('wheel', bubbled)

  expect(e.defaultPrevented).toBe(true)
  expect(bubbled).not.toHaveBeenCalled()

  flushRaf()
  expect(setScrollTop).toHaveBeenLastCalledWith(50)
})
