import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { STRAND_COLOR_JEXL } from '../../RenderFeatureDataRPC/featureColors.ts'
import GroupByDialog from './GroupByDialog.tsx'

import type { FeatureGroupBy } from '../groupBy.ts'

function setup(groupBy: FeatureGroupBy | undefined, color?: string) {
  const applyGroupBy = jest.fn()
  const openChannelSpecDialog = jest.fn()
  const handleClose = jest.fn()
  const view = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog
        model={{ groupBy, applyGroupBy, openChannelSpecDialog }}
        handleClose={handleClose}
        color={color}
      />
    </ThemeProvider>,
  )
  const checkbox = () => view.queryByRole('checkbox')
  const ticked = () => view.queryByRole('checkbox', { checked: true }) !== null
  return {
    ...view,
    applyGroupBy,
    openChannelSpecDialog,
    handleClose,
    checkbox,
    ticked,
  }
}

test('Edit as JSON... hands over to the channel spec and applies nothing', () => {
  const { getByText, applyGroupBy, openChannelSpecDialog, handleClose } =
    setup(undefined)
  fireEvent.click(getByText('Edit as JSON...'))
  expect(openChannelSpecDialog).toHaveBeenCalled()
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
  const { ticked } = setup({ type: 'strand' }, STRAND_COLOR_JEXL)
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
