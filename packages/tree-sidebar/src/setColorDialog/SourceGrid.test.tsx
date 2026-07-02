import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'

import SourceGrid from './SourceGrid.tsx'

interface Src {
  name: string
  color?: string
  labelColor?: string
}

// These tests deliberately drive the @mui/x-data-grid interaction surface
// (checkbox selection model + header sort), which MUI has reshaped across
// majors (e.g. the row-selection model became `{ type, ids: Set }`). If an
// upgrade changes that shape, `onRowSelectionModelChange`/`onSortModelChange`
// wiring in SourceGrid breaks silently in the app but loudly here.

function renderGrid(rows: Src[]) {
  const onChange = jest.fn()
  render(
    <SourceGrid
      rows={rows}
      onChange={onChange}
      showTips
      colorColumns={[{ field: 'color', headerName: 'Color' }]}
    />,
  )
  return { onChange }
}

function selectRow(name: string) {
  const row = screen.getByText(name).closest('[role="row"]')!
  fireEvent.click(within(row as HTMLElement).getByRole('checkbox'))
}

test('checkbox selection feeds the move-to-bottom action (arg.ids wiring)', () => {
  const rows: Src[] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
  const { onChange } = renderGrid(rows)

  const moveBottom = screen.getByRole('button', {
    name: /Move selected items to bottom/,
  })
  expect(moveBottom).toBeDisabled()

  selectRow('a')
  expect(moveBottom).toBeEnabled()

  fireEvent.click(moveBottom)
  expect(onChange).toHaveBeenCalledWith([
    { name: 'b' },
    { name: 'c' },
    { name: 'a' },
  ])
})

test('advanced color columns are hidden until the toggle is checked', () => {
  const onChange = jest.fn()
  render(
    <SourceGrid
      rows={[
        { name: 'a', color: '', labelColor: '' },
        { name: 'b', color: '', labelColor: '' },
      ]}
      onChange={onChange}
      showTips
      colorColumns={[
        { field: 'color', headerName: 'Color' },
        { field: 'labelColor', headerName: 'Label color', advanced: true },
      ]}
    />,
  )

  expect(
    screen.queryByRole('columnheader', { name: /Label color/ }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('checkbox', { name: /Show label color/ }))

  expect(
    screen.getByRole('columnheader', { name: /Label color/ }),
  ).toBeInTheDocument()
})

test('clicking the Name header sorts rows through onSortModelChange', () => {
  const rows: Src[] = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]
  const { onChange } = renderGrid(rows)

  fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }))

  expect(onChange).toHaveBeenCalledWith([
    { name: 'a' },
    { name: 'b' },
    { name: 'c' },
  ])
})
