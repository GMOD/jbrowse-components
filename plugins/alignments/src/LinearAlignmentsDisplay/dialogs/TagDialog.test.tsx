import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import TagDialog from './TagDialog.tsx'

import type { TagColorScale } from '../../shared/types.ts'

afterEach(cleanup)

function renderDialog(initialTag?: string, colorScale?: TagColorScale) {
  const onSubmit = jest.fn()
  const handleClose = jest.fn()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <TagDialog
        title="Sort by tag"
        prompt="Pick or enter a tag to sort by"
        onSubmit={onSubmit}
        handleClose={handleClose}
        initialTag={initialTag}
        colorScale={colorScale}
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
  expect(onSubmit).toHaveBeenCalledWith('HP', undefined)
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
  expect(onSubmit).toHaveBeenCalledWith('RG', undefined)
})

// TagTextField emits undefined for anything that isn't a valid two-character
// tag, so a half-typed name can't be applied.
test('an incomplete tag cannot be submitted', () => {
  renderDialog('HP')
  fireEvent.change(tagInput(), { target: { value: 'H' } })
  expect(screen.getByText('Submit').closest('button')).toBeDisabled()
})

test('asks how the tag colours only where the caller passes a scale', () => {
  renderDialog('NM')
  expect(screen.queryByText('A gradient over numbers')).toBeNull()
})

test('submits the colouring picked, opening on the one in use', () => {
  const { onSubmit } = renderDialog('NM', 'categorical')
  expect(screen.getByLabelText('A color per value')).toBeChecked()
  fireEvent.click(screen.getByLabelText('A gradient over numbers'))
  fireEvent.click(screen.getByText('Submit'))
  expect(onSubmit).toHaveBeenCalledWith('NM', 'linear')
})
