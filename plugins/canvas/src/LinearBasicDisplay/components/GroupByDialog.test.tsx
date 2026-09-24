import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import GroupByDialog from './GroupByDialog.tsx'

import type { AttributeScan } from './attributeVerdict.ts'

const SPEC = { facet: null }

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
  colorField = '',
  scan: AttributeScan = [],
) {
  const applyGroupBy = jest.fn()
  const groupByChannelSpec = jest.fn(() => SPEC)
  const openChannelSpecDialog = jest.fn()
  const scanGroupByCandidates = jest.fn(async () => scan)
  const handleClose = jest.fn()
  const view = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog
        model={{
          id: 'display1',
          facet: field === undefined ? undefined : { field },
          applyGroupBy,
          groupByChannelSpec,
          openChannelSpecDialog,
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
    groupByChannelSpec,
    openChannelSpecDialog,
    scanGroupByCandidates,
    handleClose,
    checkbox,
    ticked,
  }
}

test('Edit as JSON... hands over the unapplied choice as a spec and applies nothing', () => {
  const {
    getByText,
    getByLabelText,
    getByTestId,
    applyGroupBy,
    groupByChannelSpec,
    openChannelSpecDialog,
    handleClose,
  } = setup(undefined)
  fireEvent.click(getByLabelText('Attribute'))
  fireEvent.change(getByTestId('group-by-attribute'), {
    target: { value: 'gene_biotype' },
  })
  fireEvent.click(getByText('Edit as JSON...'))
  expect(groupByChannelSpec).toHaveBeenCalledWith('gene_biotype', true)
  expect(openChannelSpecDialog).toHaveBeenCalledWith(SPEC)
  expect(handleClose).toHaveBeenCalled()
  expect(applyGroupBy).not.toHaveBeenCalled()
})

test('picking strand over the default color ticks its color and applies both', () => {
  const { getByLabelText, getByText, checkbox, ticked, applyGroupBy } =
    setup(undefined)
  expect(checkbox()).toBeNull()
  fireEvent.click(getByLabelText('Strand'))
  expect(ticked()).toBe(true)
  fireEvent.click(getByText('Apply'))
  expect(applyGroupBy).toHaveBeenCalledWith('strand', true)
})

test('a color picked by hand leaves the box unticked', () => {
  const { getByLabelText, ticked } = setup(undefined, 'purple')
  fireEvent.click(getByLabelText('Strand'))
  expect(ticked()).toBe(false)
})

test('reopening over a track colored by its grouping keeps the box ticked', () => {
  const { ticked } = setup('strand', undefined, 'strand')
  expect(ticked()).toBe(true)
})

test('an attribute grouping waits for a name, and unticking applies no color', () => {
  const { getByLabelText, getByText, checkbox, applyGroupBy } = setup(undefined)
  fireEvent.click(getByLabelText('Attribute'))
  expect(getByText('Apply').closest('button')!.disabled).toBe(true)
  fireEvent.change(getByLabelText('Attribute name'), {
    target: { value: ' biotype ' },
  })
  fireEvent.click(checkbox()!)
  fireEvent.click(getByText('Apply'))
  expect(applyGroupBy).toHaveBeenCalledWith('biotype', false)
})

test('reopening over an attribute facet shows its field', () => {
  const { getByLabelText, getByTestId } = setup('gene_biotype')
  expect((getByLabelText('Attribute') as HTMLInputElement).checked).toBe(true)
  expect((getByTestId('group-by-attribute') as HTMLInputElement).value).toBe(
    'gene_biotype',
  )
})

test('the scan runs only once Attribute is chosen, and the box lists what it found with section counts', async () => {
  const { getByLabelText, getByTestId, scanGroupByCandidates } = setup(
    undefined,
    undefined,
    '',
    SCAN,
  )
  expect(scanGroupByCandidates).not.toHaveBeenCalled()
  fireEvent.click(getByLabelText('Attribute'))
  fireEvent.mouseDown(getByTestId('group-by-attribute'))
  const biotype = await screen.findByRole('option', { name: /biotype/ })
  expect(scanGroupByCandidates).toHaveBeenCalledTimes(1)
  expect(biotype.textContent).toBe('biotype2 sections')
  expect(screen.getByRole('option', { name: /^name/ }).textContent).toMatch(
    /\d+\+ sections$/,
  )
})

test('the caption says what the typed attribute sections into, before anything is applied', async () => {
  const { getByLabelText, getByTestId, applyGroupBy } = setup(
    undefined,
    undefined,
    '',
    SCAN,
  )
  fireEvent.click(getByLabelText('Attribute'))
  fireEvent.change(getByTestId('group-by-attribute'), {
    target: { value: 'biotype' },
  })
  await screen.findByText('Found values: lncRNA, protein_coding')
  fireEvent.change(getByTestId('group-by-attribute'), {
    target: { value: 'name' },
  })
  await screen.findByText(/distinct values here/)
  expect(applyGroupBy).not.toHaveBeenCalled()
})
