import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import SortByTagDialog from './SortByTagDialog.tsx'

afterEach(cleanup)

function renderDialog(initialTag?: string) {
  const onSubmit = jest.fn()
  const handleClose = jest.fn()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <SortByTagDialog
        onSubmit={onSubmit}
        handleClose={handleClose}
        initialTag={initialTag}
      />
    </ThemeProvider>,
  )
  return { onSubmit, handleClose }
}

const tagInput = () => screen.getByLabelText('Tag name')

// Both entry points ("Sort by... → Tag..." and the read right-click menu) label
// the row with the tag in use, so opening it has to show that tag — reopening
// tweaks the sort rather than resetting it, like the color and group dialogs.
test('pre-fills the tag being sorted on, and can submit it unchanged', () => {
  const { onSubmit, handleClose } = renderDialog('HP')
  expect(tagInput()).toHaveValue('HP')

  fireEvent.click(screen.getByText('Submit'))
  expect(onSubmit).toHaveBeenCalledWith('HP')
  expect(handleClose).toHaveBeenCalled()
})

test('opens empty when nothing is sorted by a tag', () => {
  renderDialog()
  expect(tagInput()).toHaveValue('')
  // nothing to apply, so Submit is inert until a valid tag is entered
  expect(screen.getByText('Submit').closest('button')).toBeDisabled()
})

test('editing the pre-filled tag submits the new one', () => {
  const { onSubmit } = renderDialog('HP')
  fireEvent.change(tagInput(), { target: { value: 'RG' } })
  fireEvent.click(screen.getByText('Submit'))
  expect(onSubmit).toHaveBeenCalledWith('RG')
})

// TagTextField emits undefined for anything that isn't a valid two-character
// tag, so a half-typed name can't be applied.
test('an incomplete tag cannot be submitted', () => {
  renderDialog('HP')
  fireEvent.change(tagInput(), { target: { value: 'H' } })
  expect(screen.getByText('Submit').closest('button')).toBeDisabled()
})
