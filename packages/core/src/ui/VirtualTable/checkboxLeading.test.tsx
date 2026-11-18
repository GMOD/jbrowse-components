import '@testing-library/jest-dom'

import { useState } from 'react'

import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import DetailTable from '../DetailTable/DetailTable.tsx'
import { createJBrowseTheme } from '../theme.ts'
import { checkboxLeading } from './checkboxLeading.tsx'

beforeAll(() => {
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
})

interface Fruit {
  id: string
  name: string
}

const rows: Fruit[] = [
  { id: 'apple', name: 'apple' },
  { id: 'apricot', name: 'apricot' },
  { id: 'banana', name: 'banana' },
]

const columns = [{ field: 'name', value: (row: Fruit) => row.name }]

function setup(initial: string[]) {
  const onChange = jest.fn<void, [Set<string>]>()
  const onRowClick = jest.fn()
  function Fruits() {
    const [selected, setSelected] = useState<ReadonlySet<string>>(
      new Set(initial),
    )
    return (
      <DetailTable
        rows={rows}
        columns={columns}
        exportName="fruits"
        onRowClick={onRowClick}
        leading={checkboxLeading<Fruit>({
          selected,
          onChange: next => {
            onChange(next)
            setSelected(next)
          },
          label: row => `Select ${row.name}`,
          allLabel: 'Select all',
        })}
      />
    )
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Fruits />
    </ThemeProvider>,
  )
  return { onChange, onRowClick }
}

function search(query: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: query },
  })
}

function lastSelection(onChange: jest.Mock<void, [Set<string>]>) {
  return [...(onChange.mock.lastCall?.[0] ?? [])].sort()
}

test('select-all selects the rows on show and keeps a hidden selection', () => {
  const { onChange } = setup(['banana'])
  search('ap')
  const all = screen.getByRole('checkbox', { name: 'Select all' })
  expect(all).not.toBeChecked()
  fireEvent.click(all)
  expect(lastSelection(onChange)).toEqual(['apple', 'apricot', 'banana'])
})

test('clearing the rows on show leaves the hidden ones selected', () => {
  const { onChange } = setup(['apple', 'apricot', 'banana'])
  search('ap')
  const all = screen.getByRole('checkbox', { name: 'Select all' })
  expect(all).toBeChecked()
  fireEvent.click(all)
  expect(lastSelection(onChange)).toEqual(['banana'])
})

test("a row's box toggles that row and does not click the row", () => {
  const { onChange, onRowClick } = setup([])
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select apricot' }))
  expect(lastSelection(onChange)).toEqual(['apricot'])
  expect(onRowClick).not.toHaveBeenCalled()
})
