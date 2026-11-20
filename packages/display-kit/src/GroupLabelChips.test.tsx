import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { GroupLabelChips } from './GroupLabelChips.tsx'

const SECTIONS = [
  { key: 'a', label: 'A', top: 0, height: 100 },
  { key: 'b', label: 'B', top: 100, height: 100 },
  { key: 'c', label: 'C', top: 200, height: 100 },
]

afterEach(() => {
  jest.restoreAllMocks()
})

function setup(onHide?: () => void) {
  const onMove = jest.fn()
  const view = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelChips
        canvasHeight={300}
        onMove={onMove}
        sections={SECTIONS.map(s => ({ ...s, onHide }))}
      />
    </ThemeProvider>,
  )
  const pill = (i: number) =>
    view.getAllByTestId('group-label-text')[i]!.parentElement!
  return { ...view, onMove, pill }
}

function drag(el: Element, fromY: number, toY: number) {
  fireEvent.pointerDown(el, { clientY: fromY, button: 0, pointerId: 1 })
  fireEvent.pointerMove(el, { clientY: toY, pointerId: 1 })
}

test('dropping a chip on a lower section moves it there, the line under that section', () => {
  const { pill, onMove, getByTestId } = setup()
  drag(pill(0), 5, 250)
  expect(getByTestId('group-drop-line').style.top).toBe('298px')
  fireEvent.pointerUp(pill(0), { clientY: 250, pointerId: 1 })
  expect(onMove).toHaveBeenCalledWith('a', 'c')
})

test('a drop above the first section moves to the top, the line over it', () => {
  const { pill, onMove, getByTestId } = setup()
  drag(pill(2), 205, -40)
  expect(getByTestId('group-drop-line').style.top).toBe('0px')
  fireEvent.pointerUp(pill(2), { clientY: -40, pointerId: 1 })
  expect(onMove).toHaveBeenCalledWith('c', 'a')
})

test('a drop on its own section, or a cancelled drag, moves nothing', () => {
  const { pill, onMove, queryByTestId } = setup()
  drag(pill(1), 105, 150)
  expect(queryByTestId('group-drop-line')).toBeNull()
  fireEvent.pointerUp(pill(1), { clientY: 150, pointerId: 1 })
  drag(pill(1), 105, 250)
  fireEvent.pointerCancel(pill(1), { pointerId: 1 })
  expect(onMove).not.toHaveBeenCalled()
})

test('a press that stays put still clicks the hide button, and a drag swallows it', () => {
  const onHide = jest.fn()
  const { getAllByTitle } = setup(onHide)
  const hide = getAllByTitle('Hide "A"')[0]!
  fireEvent.pointerDown(hide, { clientY: 5, button: 0, pointerId: 1 })
  fireEvent.pointerUp(hide, { clientY: 6, pointerId: 1 })
  fireEvent.click(hide)
  expect(onHide).toHaveBeenCalledTimes(1)
  drag(hide, 5, 250)
  fireEvent.pointerUp(hide, { clientY: 250, pointerId: 1 })
  fireEvent.click(hide)
  expect(onHide).toHaveBeenCalledTimes(1)
})

// A browser sends a captured press's click to the capturing pill, never to the
// button pressed, so only a press that becomes a drag may capture.
test('a press on the hide button takes no pointer capture until it drags', () => {
  const capture = jest.spyOn(Element.prototype, 'setPointerCapture')
  const { getAllByTitle, pill } = setup(jest.fn())
  const hide = getAllByTitle('Hide "A"')[0]!
  fireEvent.pointerDown(hide, { clientY: 5, button: 0, pointerId: 1 })
  fireEvent.pointerMove(hide, { clientY: 6, pointerId: 1 })
  fireEvent.pointerUp(hide, { clientY: 6, pointerId: 1 })
  expect(capture).not.toHaveBeenCalled()
  drag(hide, 5, 250)
  expect(capture).toHaveBeenCalledWith(1)
  expect(capture.mock.contexts[0]).toBe(pill(0))
})

test('a press that leaves its pill before the threshold captures, so the drag keeps its pointer', () => {
  const capture = jest.spyOn(Element.prototype, 'setPointerCapture')
  const { pill, onMove } = setup()
  fireEvent.pointerDown(pill(0), { clientY: 5, button: 0, pointerId: 1 })
  fireEvent.pointerLeave(pill(0), { clientY: 7, pointerId: 1 })
  expect(capture.mock.contexts[0]).toBe(pill(0))
  fireEvent.pointerMove(pill(0), { clientY: 250, pointerId: 1 })
  fireEvent.pointerUp(pill(0), { clientY: 250, pointerId: 1 })
  expect(onMove).toHaveBeenCalledWith('a', 'c')
})

test('the leading chips ride the topmost chip on screen, ahead of its pill', () => {
  const view = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelChips
        canvasHeight={300}
        sections={SECTIONS.map(s => ({ ...s, top: s.top - 150 }))}
        leading={<span data-testid="lead">Records</span>}
      />
    </ThemeProvider>,
  )
  const chips = view.getAllByTestId('group-label-chip')
  expect(view.getAllByTestId('lead')).toHaveLength(1)
  expect(chips[0]!.firstElementChild).toBe(view.getByTestId('lead'))
  expect(chips[0]!.textContent).toContain('B')
})

test('with every section hidden, the way back stands alone at the top', () => {
  const onShowHidden = jest.fn()
  const { getByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelChips
        canvasHeight={300}
        sections={[]}
        hiddenCount={2}
        onShowHidden={onShowHidden}
      />
    </ThemeProvider>,
  )
  fireEvent.click(getByRole('button', { name: 'Show 2 hidden' }))
  expect(onShowHidden).toHaveBeenCalled()
})
