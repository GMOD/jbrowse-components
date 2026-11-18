import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import DetailTable from './DetailTable.tsx'

const rows = [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
]
const columns = [{ field: 'name', value: (row: { name: string }) => row.name }]

test('a table with an export name has a search box and an export button', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DetailTable rows={rows} columns={columns} exportName="names" />
    </ThemeProvider>,
  )
  expect(screen.getByRole('textbox', { name: 'Search' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy()
})

test('a table without an export name has no search or export', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DetailTable rows={rows} columns={columns} />
    </ThemeProvider>,
  )
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
  expect(screen.getAllByRole('row')).toHaveLength(3)
})
