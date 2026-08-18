import { fireEvent, render } from '@testing-library/react'
import { createPortal } from 'react-dom'

import DisplayChrome from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// A REACT EVENT DOES NOT STOP AT A PORTAL. Everything a display floats above
// itself -- the context menu, the colour legend, the track control -- is
// portalled to another DOM node while staying a React CHILD of the chrome, and
// React bubbles by the component tree. So those clicks reached the chrome's
// `onClick`, which on every hit-testing display means "what feature is under
// this pixel": picking a menu item or dismissing a legend also opened whatever
// the overlay happened to be covering.
//
// The DOM is what tells the two apart, and `DisplayStatusChromeBase` asks it.
function OverlayPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body)
}

function setup(overlay: React.ReactNode) {
  const model = TestChromeModel.create({})
  const hitTest = jest.fn()
  const rendered = render(
    <DisplayChrome
      model={model}
      factory={stubFactory}
      testid="probe-display"
      onClick={hitTest}
      onContextMenu={hitTest}
    >
      {({ canvasRef }) => (
        <>
          <canvas data-testid="probe-canvas" ref={canvasRef} />
          {overlay}
        </>
      )}
    </DisplayChrome>,
  )
  return { hitTest, ...rendered }
}

test('a click on a portalled overlay is not hit-tested as a canvas click', () => {
  const { hitTest, getByText } = setup(
    <OverlayPortal>
      <button type="button">Dismiss</button>
    </OverlayPortal>,
  )

  fireEvent.click(getByText('Dismiss'))
  expect(hitTest).not.toHaveBeenCalled()
})

test('a right-click on a portalled overlay is not hit-tested either', () => {
  const { hitTest, getByText } = setup(
    <OverlayPortal>
      <button type="button">Dismiss</button>
    </OverlayPortal>,
  )

  fireEvent.contextMenu(getByText('Dismiss'))
  expect(hitTest).not.toHaveBeenCalled()
})

// The other half, so the guard cannot pass by refusing everything: a real click
// on the display's own content still reaches the hit test.
test('a click on the chrome itself still reaches the hit test', () => {
  const { hitTest, getByTestId } = setup(null)

  fireEvent.click(getByTestId('probe-canvas'))
  expect(hitTest).toHaveBeenCalledTimes(1)
})

test('a right-click on the chrome itself still reaches the hit test', () => {
  const { hitTest, getByTestId } = setup(null)

  fireEvent.contextMenu(getByTestId('probe-canvas'))
  expect(hitTest).toHaveBeenCalledTimes(1)
})
