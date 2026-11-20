import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import SectionsDialog from './SectionsDialog.tsx'

import type { SectionsDialogModel } from './SectionsDialog.tsx'

const SECTIONS = [
  { key: '1', label: 'Forward strand' },
  { key: '-1', label: 'Reverse strand' },
  { key: '0', label: 'Unstranded' },
]

function setup(hidden: string[] = [], sections = SECTIONS, field = 'strand') {
  const setHiddenGroups = jest.fn()
  const handleClose = jest.fn()
  const model: SectionsDialogModel = {
    facet: { field },
    knownSections: sections,
    hiddenGroups: new Set(hidden),
    setHiddenGroups,
  }
  const ui = (m: SectionsDialogModel) => (
    <ThemeProvider theme={createJBrowseTheme()}>
      <SectionsDialog model={m} handleClose={handleClose} />
    </ThemeProvider>
  )
  const { rerender } = render(ui(model))
  const ticked = () =>
    screen
      .getAllByRole('checkbox')
      .slice(1)
      .map(box => (box as HTMLInputElement).checked)
  return {
    setHiddenGroups,
    handleClose,
    ticked,
    rerenderWith: (more: typeof SECTIONS) => {
      rerender(ui({ ...model, knownSections: more }))
    },
  }
}

test('ticks the shown sections and applies the unticked keys as hidden', () => {
  const { setHiddenGroups, handleClose, ticked } = setup(['0'])
  expect(ticked()).toEqual([true, true, false])
  fireEvent.click(screen.getByLabelText('Forward strand'))
  fireEvent.click(screen.getByText('Apply'))
  expect(setHiddenGroups).toHaveBeenCalledWith(['1', '0'])
  expect(handleClose).toHaveBeenCalled()
})

test('a click on a row name toggles its box', () => {
  const { setHiddenGroups, ticked } = setup()
  fireEvent.click(screen.getByText('Reverse strand'))
  expect(ticked()).toEqual([true, false, true])
  fireEvent.click(screen.getByText('Apply'))
  expect(setHiddenGroups).toHaveBeenCalledWith(['-1'])
})

test('the header box ticks every section, then clears them all', () => {
  const { ticked } = setup(['0'])
  fireEvent.click(screen.getByLabelText('All sections'))
  expect(ticked()).toEqual([true, true, true])
  fireEvent.click(screen.getByLabelText('All sections'))
  expect(ticked()).toEqual([false, false, false])
  expect(screen.getByText('Apply').closest('button')!.disabled).toBe(true)
})

test('a section arriving while the dialog is open comes in shown, and an untouched Apply writes nothing', () => {
  const { setHiddenGroups, ticked, rerenderWith } = setup(
    ['-1'],
    SECTIONS.slice(0, 2),
  )
  rerenderWith(SECTIONS)
  expect(ticked()).toEqual([true, false, true])
  fireEvent.click(screen.getByText('Apply'))
  expect(setHiddenGroups).not.toHaveBeenCalled()
})

test('Apply waits for at least one ticked section', () => {
  const { setHiddenGroups } = setup(['1', '0'])
  fireEvent.click(screen.getByLabelText('Reverse strand'))
  expect(screen.getByText('Apply').closest('button')!.disabled).toBe(true)
  fireEvent.click(screen.getByText('Apply'))
  expect(setHiddenGroups).not.toHaveBeenCalled()
})

test('the header names the field', () => {
  setup()
  expect(screen.getByRole('columnheader', { name: /Strand/ })).toBeTruthy()
})

test('a jexl field heads its column Section', () => {
  setup([], SECTIONS, 'jexl:get(feature,"type")')
  expect(screen.getByRole('columnheader', { name: /Section/ })).toBeTruthy()
})
