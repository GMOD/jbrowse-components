import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import VirtualTable from './VirtualTable.tsx'

const rows = [{ id: 1, name: 'short', path: '/home/a/short.jbrowse' }]

function renderTable() {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VirtualTable
        rows={rows}
        columns={[
          {
            id: 'name',
            header: 'Name',
            cell: row => row.name,
            title: row => row.name,
          },
          {
            id: 'path',
            header: 'Where',
            headerTitle: 'The file the session is saved in',
            cell: row => row.name,
            title: row => row.path,
          },
        ]}
        widths={() => ({ name: 100, path: 100 })}
        sortField=""
        sortAscending
        onSort={() => {}}
        emptyMessage="none"
      />
    </ThemeProvider>,
  )
}

test('a cell and a header show their hover text in a styled tooltip, never a native title', async () => {
  const { container, getAllByText, getByText, findByRole } = renderTable()
  expect(container.querySelector('[title]')).toBeNull()

  fireEvent.mouseOver(getAllByText('short')[1]!)
  expect((await findByRole('tooltip')).textContent).toBe(
    '/home/a/short.jbrowse',
  )
  fireEvent.mouseOver(getByText('Where'))
  expect((await findByRole('tooltip')).textContent).toBe(
    'The file the session is saved in',
  )
})

test('hover text that only repeats a value opens nothing until the column cuts the value', async () => {
  const { getAllByText, findByRole, queryByRole } = renderTable()
  const nameCell = getAllByText('short')[0]!
  fireEvent.mouseOver(nameCell)
  await new Promise(resolve => setTimeout(resolve, 800))
  expect(queryByRole('tooltip')).toBeNull()

  fireEvent.mouseOut(nameCell)
  Object.defineProperties(nameCell, {
    scrollWidth: { value: 200 },
    clientWidth: { value: 100 },
  })
  fireEvent.mouseOver(nameCell)
  expect((await findByRole('tooltip')).textContent).toBe('short')
})
