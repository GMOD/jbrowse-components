import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { GroupLabelChips } from './GroupLabelChips.tsx'

const SECTIONS = [
  { key: 'a', label: 'A', top: 0, height: 100 },
  { key: 'b', label: 'B', top: 100, height: 100 },
  { key: 'c', label: 'C', top: 200, height: 100 },
]

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
