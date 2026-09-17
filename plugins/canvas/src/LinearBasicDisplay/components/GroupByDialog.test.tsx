import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import GroupByDialog from './GroupByDialog.tsx'

import type { FeatureGroupBy } from '../groupBy.ts'

const SPEC = { facet: null }

function setup(
  groupBy: FeatureGroupBy | undefined,
  color?: string,
  colorField = '',
) {
  const applyGroupBy = jest.fn()
  const groupByChannelSpec = jest.fn(() => SPEC)
  const openChannelSpecDialog = jest.fn()
  const handleClose = jest.fn()
  const view = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog
        model={{
          groupBy,
          applyGroupBy,
          groupByChannelSpec,
          openChannelSpecDialog,
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
  expect(groupByChannelSpec).toHaveBeenCalledWith(
    { type: 'attribute', attribute: 'gene_biotype' },
    true,
  )
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
  expect(applyGroupBy).toHaveBeenCalledWith({ type: 'strand' }, true)
})

test('a color picked by hand leaves the box unticked', () => {
  const { getByLabelText, ticked } = setup(undefined, 'purple')
  fireEvent.click(getByLabelText('Strand'))
  expect(ticked()).toBe(false)
})

test('reopening over a track colored by its grouping keeps the box ticked', () => {
  const { ticked } = setup({ type: 'strand' }, undefined, 'strand')
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
  expect(applyGroupBy).toHaveBeenCalledWith(
    { type: 'attribute', attribute: 'biotype' },
    false,
  )
})
