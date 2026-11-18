import { StrictMode } from 'react'

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
  const { unmount } = render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <EditableTextCell
          value="old"
          label="Rename old"
          onCommit={onCommit}
          allowBlank={allowBlank}
          editOnClick={editOnClick}
        />
      </ThemeProvider>
    </StrictMode>,
  )
  return { onCommit, unmount }
}

function openInput() {
  fireEvent.click(screen.getByRole('button', { name: 'Rename old' }))
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Rename old' })
}

test('Enter commits the typed text and closes the input', () => {
  const { onCommit } = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).toHaveBeenCalledWith('new')
  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('leaving the input commits the typed text', () => {
  const { onCommit } = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.blur(input)
  expect(onCommit).toHaveBeenCalledWith('new')
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('Escape closes the input and commits nothing', () => {
  const { onCommit } = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(onCommit).not.toHaveBeenCalled()
})

test('an unchanged or blank value commits nothing', () => {
  const { onCommit } = setup()
  fireEvent.keyDown(openInput(), { key: 'Enter' })
  const input = openInput()
  fireEvent.change(input, { target: { value: '  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).not.toHaveBeenCalled()
})

test('a cell that takes blanks commits an emptied value', () => {
  const { onCommit } = setup({ allowBlank: true })
  const input = openInput()
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).toHaveBeenCalledWith('')
})

test('a click on the text opens the input only when asked', () => {
  setup()
  fireEvent.click(screen.getByText('old'))
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('a click on the text opens the input on a cell that edits on click', () => {
  setup({ editOnClick: true })
  fireEvent.click(screen.getByText('old'))
  expect(screen.getByRole('textbox', { name: 'Rename old' })).toBeTruthy()
})

test('a row scrolled out of view commits what was typed', () => {
  const { onCommit, unmount } = setup()
  fireEvent.change(openInput(), { target: { value: 'new' } })
  unmount()
  expect(onCommit).toHaveBeenCalledWith('new')
  expect(onCommit).toHaveBeenCalledTimes(1)
})

test('an untouched input that unmounts commits nothing', () => {
  const { onCommit, unmount } = setup()
  openInput()
  expect(screen.getByRole('textbox')).toBeTruthy()
  unmount()
  expect(onCommit).not.toHaveBeenCalled()
})

test('Enter or Escape while an IME composes keeps the input open', () => {
  const { onCommit } = setup()
  const input = openInput()
  fireEvent.change(input, { target: { value: 'new' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  fireEvent.keyDown(input, { key: 'Escape', isComposing: true })
  expect(screen.getByRole('textbox')).toBe(input)
  expect(onCommit).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCommit).toHaveBeenCalledWith('new')
})

test('focus returns to the pencil after Enter or Escape', () => {
  setup()
  fireEvent.keyDown(openInput(), { key: 'Enter' })
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Rename old' }),
  )
  fireEvent.keyDown(openInput(), { key: 'Escape' })
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Rename old' }),
  )
})

test('leaving the input does not pull focus back to the pencil', () => {
  setup()
  fireEvent.blur(openInput())
  expect(document.activeElement).not.toBe(
    screen.getByRole('button', { name: 'Rename old' }),
  )
})
