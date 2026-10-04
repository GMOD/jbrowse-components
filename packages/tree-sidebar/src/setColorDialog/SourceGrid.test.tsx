import '@testing-library/jest-dom'

import { fireEvent, render, screen, within } from '@testing-library/react'

import SourceGrid from './SourceGrid.tsx'

interface Src {
  name: string
  color?: string
  rowColor?: string
}

// These tests deliberately drive the @mui/x-data-grid interaction surface
// (checkbox selection model + header sort), which MUI has reshaped across
// majors (e.g. the row-selection model became `{ type, ids: Set }`). If an
// upgrade changes that shape, `onRowSelectionModelChange`/`onSortModelChange`
// wiring in SourceGrid breaks silently in the app but loudly here.

const RESERVED = new Set(['name', 'source', 'baseUri', 'color', 'rowColor'])

function renderGrid(rows: Src[]) {
  const onChange = jest.fn()
  render(
    <SourceGrid
      rows={rows}
      onChange={onChange}
      colors={new Map()}
      eachRow={{ picks: new Map(), onPick: () => {} }}
      reserved={RESERVED}
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

// A row's own colour must not fall through to the auto-derived extras and
// render as a raw hex text column.
test("a row's own colour is not rendered as an extras column", () => {
  const rows: Src[] = [{ name: 'a', color: '#f00', rowColor: '#0f0' }]
  renderGrid(rows)

  expect(
    screen.queryByRole('columnheader', { name: 'color' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('#f00')).not.toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: 'Color' }),
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
