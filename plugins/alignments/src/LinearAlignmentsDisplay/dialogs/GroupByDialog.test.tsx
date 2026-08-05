import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import GroupByDialog from './GroupByDialog.tsx'

import type { ColorBy, GroupBy } from '../../shared/types.ts'
import type { GroupByDialogModel } from './GroupByDialog.tsx'

afterEach(cleanup)

// Only the tag/color surface is exercised here: the distinct-value lookup is
// debounced a second behind the box, so an unadvanced test never issues it and
// needs no view or RPC.
function renderDialog(state: { colorBy: ColorBy; groupBy?: GroupBy }) {
  const setGroupBy = jest.fn()
  const setColorScheme = jest.fn()
  const model = {
    id: 'display1',
    colorBy: state.colorBy,
    groupBy: state.groupBy,
    filterBy: {},
    setGroupBy,
    setColorScheme,
  } as unknown as GroupByDialogModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  return { setGroupBy, setColorScheme }
}

const checkbox = () => screen.getByRole('checkbox') as HTMLInputElement

function typeTag(tag: string) {
  fireEvent.change(screen.getByTestId('group-tag-name-input'), {
    target: { value: tag },
  })
}

function submit() {
  fireEvent.click(screen.getByText('Submit'))
}

// The box is a default until it is clicked, and the tag it defaults against is
// the one in the box — not the one the model held when the dialog opened. Reads
// already colored by HP, grouped by nothing: the box used to open unticked
// (there was no groupBy to compare against), and unticked means "don't color by
// this tag", so submitting reset the HP coloring the user could see.
test('typing the tag the reads are already colored by keeps that coloring', () => {
  const { setGroupBy, setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'HP' },
  })
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  submit()
  expect(setGroupBy).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
})

// A different tag's colors are in force, so the box stays a genuine offer to
// replace them and does nothing unless taken.
test('a different tag colouring leaves the box unticked and untouched', () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'RG' },
  })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  submit()
  expect(setColorScheme).not.toHaveBeenCalled()
})

// Grouping by a tag usually pairs with coloring by it, so an uncolored track
// opts in by default.
test('an uncolored track defaults to coloring by the grouped tag', () => {
  const { setColorScheme } = renderDialog({ colorBy: { type: 'normal' } })
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  submit()
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
})

// Unticking is still how you drop the coloring this dialog would set, and it
// pins: the default no longer re-ticks the box as the tag is edited.
test('unticking drops the matching coloring and stays unticked', () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'HP' },
    groupBy: { type: 'tag', tag: 'HP' },
  })
  expect(checkbox().checked).toBe(true)
  fireEvent.click(checkbox())
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  submit()
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'normal' })
})
