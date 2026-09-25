import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import PlotFieldDialog from './PlotFieldDialog.tsx'

import type { PlotSpec } from '../plotFields.ts'
import type { PlotFieldDialogModel } from './PlotFieldDialog.tsx'

const EMPTY: PlotSpec = {
  field: '',
  mark: 'bar',
  colorField: '',
  binned: false,
}

function setup(model: Partial<PlotFieldDialogModel>) {
  const setPlotMarks = jest.fn()
  const openPlotJsonDialog = jest.fn()
  const result = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PlotFieldDialog
        model={{
          plotFields: { numeric: ['score'], categorical: ['repClass'] },
          plotFieldsError: undefined,
          plotSpec: EMPTY,
          plotSpecReplaces: 0,
          plotScanLocus: 'ctgA:1..20,000',
          setPlotMarks,
          plotMarkPlot: spec => ({ marks: [{ encoding: { y: spec.field } }] }),
          openPlotJsonDialog,
          ...model,
        }}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
  return { ...result, setPlotMarks, openPlotJsonDialog }
}

function pick(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

test('Apply is refused until a field is chosen', () => {
  const { getByText, setPlotMarks } = setup({})
  expect(getByText('Apply').closest('button')!.disabled).toBe(true)
  pick('Value field', 'score')
  fireEvent.click(getByText('Apply'))
  expect(setPlotMarks).toHaveBeenCalledWith({ ...EMPTY, field: 'score' })
})

test('the mark, the colour field and the binned box reach the submit', () => {
  const { getByText, setPlotMarks } = setup({})
  pick('Value field', 'score')
  pick('Mark', 'point')
  pick('Color by', 'repClass')
  fireEvent.click(getByText('Count per bin zoomed out'))
  fireEvent.click(getByText('Apply'))
  expect(setPlotMarks).toHaveBeenCalledWith({
    field: 'score',
    mark: 'point',
    colorField: 'repClass',
    binned: true,
  })
})

test('an existing plot reopens prefilled', () => {
  const plotSpec: PlotSpec = {
    field: 'score',
    mark: 'point',
    colorField: 'repClass',
    binned: true,
  }
  const { getByText, setPlotMarks } = setup({ plotSpec })
  fireEvent.click(getByText('Apply'))
  expect(setPlotMarks).toHaveBeenCalledWith(plotSpec)
})

test('the scan says so while it runs', () => {
  const { getByText } = setup({ plotFields: undefined })
  expect(getByText(/Scanning features for fields/)).toBeTruthy()
})

test('a scan with no numeric field names the window it read', () => {
  const { getByText } = setup({
    plotFields: { numeric: [], categorical: ['repClass'] },
  })
  expect(getByText(/No feature in ctgA:1\.\.20,000/)).toBeTruthy()
})

test('a scan error is reported in the dialog', () => {
  const { getByText } = setup({
    plotFields: undefined,
    plotFieldsError: new Error('no such file'),
  })
  expect(getByText(/no such file/)).toBeTruthy()
})

// Applying replaces the whole `marks` list, so a config the dialog could not
// read back loses what it said unless the user has seen that named.
test('a config the dialog cannot read is named, and Apply waits on the acknowledgement', () => {
  const { getByText, setPlotMarks } = setup({ plotSpecReplaces: 2 })
  pick('Value field', 'score')
  expect(getByText(/declares 2 marks/)).toBeTruthy()
  expect(getByText('Apply').closest('button')!.disabled).toBe(true)
  fireEvent.click(getByText('Replace the declared marks'))
  fireEvent.click(getByText('Apply'))
  expect(setPlotMarks).toHaveBeenCalledWith({ ...EMPTY, field: 'score' })
})

// The unapplied form state travels, so an edit made here is not lost on the way
// to the box that holds everything this dialog cannot say.
test('Edit as JSON hands the form state over unapplied', () => {
  const { getByText, openPlotJsonDialog, setPlotMarks } = setup({
    plotSpecReplaces: 3,
  })
  pick('Value field', 'score')
  fireEvent.click(getByText('Edit as JSON...'))
  expect(openPlotJsonDialog).toHaveBeenCalledWith({
    marks: [{ encoding: { y: 'score' } }],
  })
  expect(setPlotMarks).not.toHaveBeenCalled()
})
