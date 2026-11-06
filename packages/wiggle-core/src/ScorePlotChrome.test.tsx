import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/display-ui'
import { act, fireEvent, render } from '@testing-library/react'

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

function makeModel(dataLeft = 0) {
  const model = {
    configuration: { displayId: 'probe' },
    height: 100,
    canvasWidthPx: 200,
    dataLeft,
    scrollableHeight: 0,
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
  } satisfies ScorePlotChromeModel<Hit, unknown, FrameDimensions> &
    ScorePlotContextMenuHost<Hit>
  return model
}

function withoutMenu(model: ReturnType<typeof makeModel>) {
  const {
    contextMenuInfo: _info,
    openContextMenu: _open,
    closeContextMenu: _close,
    contextMenuItems: _items,
    ...rest
  } = model
  return rest
}

function renderPlot(withContextMenu: boolean) {
  const model = makeModel()
  const findHit = jest.fn((x: number, y: number): Hit => ({ x, y }))
  const { getByTestId } = render(
    <ScorePlotChrome
      model={withContextMenu ? model : withoutMenu(model)}
      marks={[]}
      testid="score-plot"
      findHit={findHit}
      tooltip={() => null}
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

test('a context hit of its own opens the menu where the hover hit is absent', () => {
  const model = makeModel()
  const { getByTestId } = render(
    <ScorePlotChrome
      model={model}
      marks={[]}
      testid="score-plot"
      findHit={() => undefined}
      findContextHit={(x, y) => ({ x, y })}
      tooltip={() => null}
    />,
  )
  fireEvent.contextMenu(getByTestId('score-plot'), { clientX: 10, clientY: 30 })
  expect(model.openContextMenu).toHaveBeenCalledWith({
    clientX: 10,
    clientY: 30,
    hit: { x: 10, y: 30 - YSCALEBAR_LABEL_OFFSET },
  })
})

// The tree sidebar draws over the plot's left and takes its own clicks, which
// bubble to the chrome; a hit there would select the record under a tree node.
describe('left of dataLeft, over the sidebar', () => {
  const DATA_LEFT = 40

  function renderBehindSidebar() {
    const model = makeModel(DATA_LEFT)
    const findHit = jest.fn((x: number, y: number): Hit => ({ x, y }))
    const findContextHit = jest.fn((x: number, y: number): Hit => ({ x, y }))
    const { getByTestId } = render(
      <ScorePlotChrome
        model={model}
        marks={[]}
        testid="score-plot"
        findHit={findHit}
        findContextHit={findContextHit}
        tooltip={() => null}
      />,
    )
    return { model, findHit, findContextHit, chrome: getByTestId('score-plot') }
  }

  test('a click selects nothing, and one on the edge selects', () => {
    const { model, chrome } = renderBehindSidebar()
    fireEvent.click(chrome, { clientX: DATA_LEFT - 1, clientY: 30 })
    expect(model.selectFeature).not.toHaveBeenCalled()
    fireEvent.click(chrome, { clientX: DATA_LEFT, clientY: 30 })
    expect(model.selectFeature).toHaveBeenCalledWith({
      x: DATA_LEFT,
      y: 30 - YSCALEBAR_LABEL_OFFSET,
    })
  })

  test('a right-click opens no menu on a hit', () => {
    const { model, findContextHit, chrome } = renderBehindSidebar()
    fireEvent.contextMenu(chrome, { clientX: DATA_LEFT - 1, clientY: 30 })
    expect(findContextHit).not.toHaveBeenCalled()
    expect(model.openContextMenu).not.toHaveBeenCalled()
  })

  test('a hover names nothing', () => {
    jest.useFakeTimers()
    try {
      const { model, findHit, chrome } = renderBehindSidebar()
      fireEvent.mouseMove(chrome, { clientX: DATA_LEFT - 1, clientY: 30 })
      act(() => {
        jest.runOnlyPendingTimers()
      })
      expect(findHit).not.toHaveBeenCalled()
      expect(model.setHoveredFeature).toHaveBeenLastCalledWith(undefined)
    } finally {
      jest.useRealTimers()
    }
  })
})
