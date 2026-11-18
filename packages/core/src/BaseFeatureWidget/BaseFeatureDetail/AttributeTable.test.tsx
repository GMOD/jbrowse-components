import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { createJBrowseTheme } from '../../ui/theme.ts'
import AttributeTable from './AttributeTable.tsx'

function renderTable(value: Record<string, unknown>[]) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AttributeTable name="hits" value={value} />
    </ThemeProvider>,
  )
}

function columnTexts(column: number) {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('cell')[column]?.textContent)
}

test('a numeric zero renders as "0", not empty', () => {
  renderTable([
    { allele: 'A', count: 0 },
    { allele: 'T', count: 5 },
  ])
  expect(columnTexts(1)).toEqual(['0', '5'])
})

test("an object's own id stays a column, even when ids repeat", () => {
  renderTable([
    { id: 'same', label: 'first' },
    { id: 'same', label: 'second' },
  ])
  expect(screen.getByRole('columnheader', { name: 'id' })).toBeTruthy()
  expect(columnTexts(1)).toEqual(['first', 'second'])
})

test('a header click sorts ascending, then descending, then file order', () => {
  renderTable([{ n: 'b10' }, { n: 'a' }, { n: 'b9' }])
  const header = within(
    screen.getByRole('columnheader', { name: 'n' }),
  ).getByRole('button')
  fireEvent.click(header)
  expect(columnTexts(0)).toEqual(['a', 'b9', 'b10'])
  fireEvent.click(header)
  expect(columnTexts(0)).toEqual(['b10', 'b9', 'a'])
  fireEvent.click(header)
  expect(columnTexts(0)).toEqual(['b10', 'a', 'b9'])
})

test('the search keeps rows holding every word, and counts them', () => {
  renderTable([
    { name: 'tx1', score: 'high' },
    { name: 'tx2', score: 'low' },
    { name: 'tx3', score: 'HIGH' },
  ])
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: 'high  tx3' },
  })
  expect(columnTexts(0)).toEqual(['tx3'])
  expect(screen.getByRole('status').textContent).toBe('1 of 3')
})

test('cells render their HTML sanitized', () => {
  renderTable([
    { name: '<b>bold</b><img src=x onerror=alert(1)>' },
    { name: 'plain' },
  ])
  expect(document.querySelector('td b')?.textContent).toBe('bold')
  expect(document.querySelector('td img[onerror]')).toBeNull()
})
