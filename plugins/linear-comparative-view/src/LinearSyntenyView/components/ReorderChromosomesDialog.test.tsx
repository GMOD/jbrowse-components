import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'
import { action, observable } from 'mobx'

import ReorderChromosomesDialog from './ReorderChromosomesDialog.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'

function stack(assemblies: string[]) {
  const model = observable({
    views: assemblies.map(name => ({ assemblyNames: [name] })),
    diagonalizeAnchorRow: 0,
    setDiagonalizeAnchorRow: action((row: number) => {
      model.diagonalizeAnchorRow = row
    }),
    finishAutoDiagonalize: () => {},
  })
  return model as unknown as LinearSyntenyViewModel
}

test('the anchor picker shows the row that was picked', async () => {
  const model = stack(['BIN', 'HCA', 'RES'])
  render(<ReorderChromosomesDialog model={model} handleClose={() => {}} />)
  fireEvent.mouseDown(screen.getByRole('combobox'))
  fireEvent.click(await screen.findByRole('option', { name: 'RES' }))
  expect(model.diagonalizeAnchorRow).toBe(2)
  expect(screen.getByRole('combobox')).toHaveTextContent('RES')
})

test('an assembly stacked twice is listed once per row', async () => {
  const model = stack(['hg38', 'hg38', 'mm39'])
  render(<ReorderChromosomesDialog model={model} handleClose={() => {}} />)
  fireEvent.mouseDown(screen.getByRole('combobox'))
  expect(
    await screen.findByRole('option', { name: 'hg38 (row 2)' }),
  ).toBeInTheDocument()
})
