import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import GroupByDialog from './GroupByDialog.tsx'

import type { AttributeScan } from './attributeVerdict.ts'

const PLOT = { facet: null }

const SCAN: AttributeScan = [
  {
    field: 'biotype',
    values: ['lncRNA', 'protein_coding'],
    missing: false,
    overflow: false,
  },
  { field: 'name', values: [], missing: false, overflow: true },
]

function setup(
  field: string | undefined,
  color?: string,
  colorField?: string,
  scan: AttributeScan = [],
) {
  const applyGroupBy = jest.fn()
  const groupByPlot = jest.fn(() => PLOT)
  const openPlotDialog = jest.fn()
  const scanGroupByCandidates = jest.fn(async () => scan)
  const handleClose = jest.fn()
  const view = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog
        model={{
          id: 'display1',
          facet: field === undefined ? undefined : { field },
          applyGroupBy,
          groupByPlot,
          openPlotDialog,
          scanGroupByCandidates,
        }}
        handleClose={handleClose}
        color={color}
        colorField={colorField}
      />
    </ThemeProvider>,
  )
  const checkbox = () => view.queryByRole('checkbox')
  const ticked = () => view.queryByRole('checkbox', { checked: true }) !== null
  return {
    ...view,
    applyGroupBy,
    groupByPlot,
    openPlotDialog,
    scanGroupByCandidates,
    handleClose,
    checkbox,
    ticked,
  }
}

function typeAttribute(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } })
}

test('Edit plot... hands over the unapplied choice as a plot and applies nothing', () => {
  const {
    getByText,
    getByTestId,
    applyGroupBy,
    groupByPlot,
    openPlotDialog,
    handleClose,
  } = setup(undefined)
  typeAttribute(getByTestId('group-by-attribute'), 'gene_biotype')
  fireEvent.click(getByText('Edit plot...'))
  expect(groupByPlot).toHaveBeenCalledWith('gene_biotype', true)
  expect(openPlotDialog).toHaveBeenCalledWith(PLOT)
  expect(handleClose).toHaveBeenCalled()
  expect(applyGroupBy).not.toHaveBeenCalled()
})

test('over the default color the box starts ticked and applies both', () => {
  const { getByTestId, getByText, ticked, applyGroupBy } = setup(undefined)
  typeAttribute(getByTestId('group-by-attribute'), 'biotype')
  expect(ticked()).toBe(true)
  fireEvent.click(getByText('Apply'))
  expect(applyGroupBy).toHaveBeenCalledWith('biotype', true)
})

test('a color picked by hand leaves the box unticked', () => {
  const { ticked } = setup(undefined, 'purple')
  expect(ticked()).toBe(false)
})

test('reopening over a track colored by its grouping keeps the box ticked', () => {
  const { ticked } = setup('biotype', 'purple', 'biotype')
  expect(ticked()).toBe(true)
})

test('Apply waits for a name, and unticking applies no color', () => {
  const { getByLabelText, getByText, checkbox, applyGroupBy } = setup(undefined)
  expect(getByText('Apply').closest('button')!.disabled).toBe(true)
  typeAttribute(getByLabelText('Attribute name'), ' biotype ')
  fireEvent.click(checkbox()!)
  fireEvent.click(getByText('Apply'))
  expect(applyGroupBy).toHaveBeenCalledWith('biotype', false)
})

test('reopening shows the attribute facet, and a strand facet as no attribute', () => {
  const value = (view: ReturnType<typeof setup>) => {
    const text = (view.getByTestId('group-by-attribute') as HTMLInputElement)
      .value
    view.unmount()
    return text
  }
  expect(value(setup('gene_biotype'))).toBe('gene_biotype')
  expect(value(setup('strand'))).toBe('')
})

test('the box lists what the scan found in view, with section counts', async () => {
  const { getByTestId, scanGroupByCandidates } = setup(
    undefined,
    undefined,
    undefined,
    SCAN,
  )
  fireEvent.mouseDown(getByTestId('group-by-attribute'))
  const biotype = await screen.findByRole('option', { name: /biotype/ })
  expect(scanGroupByCandidates).toHaveBeenCalledTimes(1)
  expect(biotype.textContent).toBe('biotype2 sections')
  expect(screen.getByRole('option', { name: /^name/ }).textContent).toMatch(
    /\d+\+ sections$/,
  )
})

test('the caption says what the typed attribute sections into, before anything is applied', async () => {
  const { getByTestId, applyGroupBy } = setup(
    undefined,
    undefined,
    undefined,
    SCAN,
  )
  typeAttribute(getByTestId('group-by-attribute'), 'biotype')
  await screen.findByText('Found values: lncRNA, protein_coding')
  typeAttribute(getByTestId('group-by-attribute'), 'name')
  await screen.findByText(/distinct values here/)
  expect(applyGroupBy).not.toHaveBeenCalled()
})
