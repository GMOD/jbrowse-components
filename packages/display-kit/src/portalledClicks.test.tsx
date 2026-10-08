import { PointerLayer } from '@jbrowse/display-ui'
import { fireEvent, render } from '@testing-library/react'
import { createPortal } from 'react-dom'

import DisplayChrome from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type { MouseState } from '@jbrowse/core/ui/useMouseTracking'

// A REACT EVENT DOES NOT STOP AT A PORTAL. Everything a display floats above
// itself -- the context menu, the colour legend, the track control -- is
// portalled to another DOM node while staying a React CHILD of the chrome, and
// React bubbles by the component tree. So those events reached the chrome's
// handlers, which on a hit-testing display mean "what feature is under this
// pixel": picking a menu item or dismissing a legend also opened whatever the
// overlay happened to be covering.
//
// The DOM is what tells the two apart, and `DisplayChromeBase` asks it.
function OverlayPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body)
}

// Every positional handler, because the displays don't agree on which one they
// hit-test from: multi-row features and the wiggles use `onClick`, maf resolves
// its click from `onMouseUp` after a drag that starts on `onMouseDown`, and the
// chrome's own hover measurement rides `onMouseMove`.
function setup(overlay: React.ReactNode) {
  const model = TestChromeModel.create({})
  const hitTest = jest.fn()
  const leave = jest.fn()
  const rendered = render(
    <DisplayChrome
      model={model}
      factory={stubFactory}
      testid="probe-display"
      onClick={hitTest}
      onContextMenu={hitTest}
      onMouseDown={hitTest}
      onMouseUp={hitTest}
      onMouseMove={hitTest}
      onMouseLeave={leave}
    >
      {({ canvasRef }) => (
        <>
          <canvas data-testid="probe-canvas" ref={canvasRef} />
          {overlay}
        </>
      )}
    </DisplayChrome>,
  )
  return { hitTest, leave, ...rendered }
}

function fireEveryPointerEvent(el: HTMLElement) {
  fireEvent.click(el)
  fireEvent.contextMenu(el)
  fireEvent.mouseDown(el)
  fireEvent.mouseUp(el)
  fireEvent.mouseMove(el)
}

const OVERLAY = (
  <OverlayPortal>
    <button type="button">Dismiss</button>
  </OverlayPortal>
)

test('no pointer event on a portalled overlay is hit-tested as a canvas event', () => {
  const { hitTest, getByText } = setup(OVERLAY)

  fireEveryPointerEvent(getByText('Dismiss'))
  expect(hitTest).not.toHaveBeenCalled()
})

// The other half, so the guard cannot pass by refusing everything: the real
// events on the display's own content all still reach the hit test.
test('pointer events on the chrome itself still reach the hit test', () => {
  const { hitTest, getByTestId } = setup(null)

  fireEveryPointerEvent(getByTestId('probe-canvas'))
  expect(hitTest).toHaveBeenCalledTimes(5)
})

// The enter/leave pair is deliberately outside the guard. React derives it from
// the component tree too, so a pointer that wanders off a portalled overlay and
// out of the page leaves the chrome, reporting the overlay as what it left — and
// that is the display's only signal to clear a hover it can no longer see.
test('leaving the page from a portalled overlay still clears the hover', () => {
  const { leave, getByText } = setup(OVERLAY)

  fireEvent.mouseOut(getByText('Dismiss'), { relatedTarget: null })
  expect(leave).toHaveBeenCalledTimes(1)
})

// React fires no `mouseleave` on the chrome for a pointer crossing onto a
// portalled overlay, the overlay being its React child, so the move over it is
// the only signal the hover has ended.
test('moving onto a portalled overlay drops the tracked pointer', () => {
  const frame = jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
  const model = TestChromeModel.create({})
  const positions: (MouseState | undefined)[] = []
  const { getByText, getByTestId } = render(
    <DisplayChrome
      model={model}
      factory={stubFactory}
      testid="probe-display"
      onPointerPosition={state => positions.push(state)}
    >
      {({ canvasRef, mouseTracker }) => (
        <>
          <canvas data-testid="probe-canvas" ref={canvasRef} />
          <PointerLayer mouseTracker={mouseTracker}>
            {state => (
              <div data-testid="pointer">{state ? 'tracked' : 'none'}</div>
            )}
          </PointerLayer>
          {OVERLAY}
        </>
      )}
    </DisplayChrome>,
  )
  fireEvent.mouseMove(getByTestId('probe-canvas'), { clientX: 10, clientY: 10 })
  expect(getByTestId('pointer').textContent).toBe('tracked')

  fireEvent.mouseMove(getByText('Dismiss'), { clientX: 500, clientY: 10 })
  expect(getByTestId('pointer').textContent).toBe('none')
  expect(positions.at(-1)).toBeUndefined()
  frame.mockRestore()
})
