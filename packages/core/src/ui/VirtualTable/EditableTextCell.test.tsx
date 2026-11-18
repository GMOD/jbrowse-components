import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { createJBrowseTheme } from '../theme.ts'
import EditableTextCell from './EditableTextCell.tsx'

const theme = createJBrowseTheme()

function setup({
  allowBlank,
  editOnClick,
}: { allowBlank?: boolean; editOnClick?: boolean } = {}) {
  const onCommit = jest.fn()
  render(
    <ThemeProvider theme={theme}>
      <EditableTextCell
        value="old"
        label="Rename old"
        onCommit={onCommit}
        allowBlank={allowBlank}
        editOnClick={editOnClick}
      />
    </ThemeProvider>,
  )
  return onCommit
}

function openInput() {
  fireEvent.doubleClick(screen.getByRole('button', { name: 'Rename old' }))
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Rename old' })
}

test('Enter commits the typed text and closes the input', () => {
  const onCommit = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).toHaveBeenCalledWith('new')
  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('leaving the input commits the typed text', () => {
  const onCommit = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.blur(input)
  expect(onCommit).toHaveBeenCalledWith('new')
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('Escape closes the input and commits nothing', () => {
  const onCommit = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(onCommit).not.toHaveBeenCalled()
})

test('an unchanged or blank value commits nothing', () => {
  const onCommit = setup()
  fireEvent.keyDown(openInput(), { key: 'Enter' })
  const input = openInput()
  fireEvent.change(input, { target: { value: '  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).not.toHaveBeenCalled()
})

test('a cell that takes blanks commits an emptied value', () => {
  const onCommit = setup({ allowBlank: true })
  const input = openInput()
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).toHaveBeenCalledWith('')
})

test('F2 or Enter on the focused text opens the input, a click only when asked', () => {
  setup()
  const text = screen.getByRole('button', { name: 'Rename old' })
  fireEvent.click(text)
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.keyDown(text, { key: 'F2' })
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
  fireEvent.keyDown(screen.getByRole('button', { name: 'Rename old' }), {
    key: 'Enter',
  })
  expect(screen.getByRole('textbox')).toBeTruthy()
})

test('a single click opens the input on a cell that edits on click', () => {
  setup({ editOnClick: true })
  fireEvent.click(screen.getByRole('button', { name: 'Rename old' }))
  expect(screen.getByRole('textbox', { name: 'Rename old' })).toBeTruthy()
})
