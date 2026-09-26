import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/display-ui'
import { fireEvent, render } from '@testing-library/react'

import { ScorePlotChrome } from './ScorePlotChrome.tsx'

import type {
  ScorePlotChromeModel,
  ScorePlotContextMenuHost,
} from './ScorePlotChrome.tsx'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type { FrameDimensions } from '@jbrowse/render-core/renderingBackendBase'

interface Hit {
  x: number
  y: number
}

function makeModel() {
  const model = {
    configuration: { displayId: 'probe' },
    height: 100,
    canvasWidthPx: 200,
    displayPhase: 'ready' as const,
    painted: false,
    error: undefined,
    regionTooLargeReason: '',
    zoomCanReleaseGate: true,
    renderError: undefined,
    reload: jest.fn(),
    forceLoad: jest.fn(),
    renderNow: jest.fn(),
    setRenderError: jest.fn(),
    setOffScreen: jest.fn(),
    startRenderingBackend: jest.fn(),
    stopRenderingBackend: jest.fn(),
    setHoveredFeature: jest.fn<undefined, [Hit | undefined]>(),
    selectFeature: jest.fn<undefined, [Hit]>(),
    contextMenuInfo: undefined,
    openContextMenu: jest.fn<undefined, [ContextMenuAnchor & { hit: Hit }]>(),
    closeContextMenu: jest.fn(),
    contextMenuItems: () => [{ label: 'probe', onClick: () => {} }],
    clearHoveredFeature: jest.fn(),
  } satisfies ScorePlotChromeModel<Hit, unknown, FrameDimensions> &
    ScorePlotContextMenuHost<Hit>
  return model
}

function renderPlot(withContextMenu: boolean) {
  const model = makeModel()
  const findHit = jest.fn((x: number, y: number): Hit => ({ x, y }))
  const { getByTestId } = render(
    <ScorePlotChrome
      model={model}
      marks={[]}
      testid="score-plot"
      findHit={findHit}
      tooltip={() => null}
      contextMenu={withContextMenu ? model : undefined}
    />,
  )
  return { model, findHit, chrome: getByTestId('score-plot') }
}

test('a click selects the hit, measured from the plot top', () => {
  const { model, chrome } = renderPlot(false)
  fireEvent.click(chrome, { clientX: 10, clientY: 30 })
  expect(model.selectFeature).toHaveBeenCalledWith({
    x: 10,
    y: 30 - YSCALEBAR_LABEL_OFFSET,
  })
})

test('a right-click opens the menu on the same hit and claims the event', () => {
  const { model, chrome } = renderPlot(true)
  const notPrevented = fireEvent.contextMenu(chrome, {
    clientX: 10,
    clientY: 30,
  })
  expect(model.openContextMenu).toHaveBeenCalledWith({
    clientX: 10,
    clientY: 30,
    hit: { x: 10, y: 30 - YSCALEBAR_LABEL_OFFSET },
  })
  expect(notPrevented).toBe(false)
})

test('without a context menu a right-click stays the browser menu', () => {
  const { findHit, chrome } = renderPlot(false)
  const notPrevented = fireEvent.contextMenu(chrome, {
    clientX: 10,
    clientY: 30,
  })
  expect(notPrevented).toBe(true)
  expect(findHit).not.toHaveBeenCalled()
})
