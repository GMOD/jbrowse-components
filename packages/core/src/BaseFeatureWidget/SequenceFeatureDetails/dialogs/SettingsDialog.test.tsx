import { fireEvent, render } from '@testing-library/react'

import { SequenceFeatureDetailsF } from '../model.ts'
import SequenceFeatureSettingsDialog from './SettingsDialog.tsx'

beforeEach(() => {
  localStorage.clear()
})

function renderDialog() {
  const model = SequenceFeatureDetailsF().create()
  const handleClose = jest.fn()
  const utils = render(
    <SequenceFeatureSettingsDialog model={model} handleClose={handleClose} />,
  )
  return { model, handleClose, ...utils }
}

const keepCase = 'Capitalization from reference genome sequence'

test('the capitalization waits for Submit like the other settings', () => {
  const { model, handleClose, getByLabelText, getByRole } = renderDialog()
  fireEvent.click(getByLabelText(keepCase))
  expect(model.upperCaseCDS).toBe(true)

  fireEvent.click(getByRole('button', { name: 'Submit' }))
  expect(model.upperCaseCDS).toBe(false)
  expect(handleClose).toHaveBeenCalled()
})

test('Cancel leaves the capitalization as it was', () => {
  const { model, getByLabelText, getByRole } = renderDialog()
  fireEvent.click(getByLabelText(keepCase))
  fireEvent.click(getByRole('button', { name: 'Cancel' }))
  expect(model.upperCaseCDS).toBe(true)
})

test.each([
  'Number of intronic bases around splice site to display',
  'Number of bases up/down stream of feature to display',
])('a negative "%s" is refused', label => {
  const { getByLabelText, getByRole } = renderDialog()
  fireEvent.change(getByLabelText(label), { target: { value: '-5' } })
  expect(getByRole('button', { name: 'Submit' })).toHaveProperty(
    'disabled',
    true,
  )
})

test('a row of zero bases is refused', () => {
  const { getByLabelText, getByRole } = renderDialog()
  fireEvent.change(getByLabelText('Number of bases per row'), {
    target: { value: '0' },
  })
  expect(getByRole('button', { name: 'Submit' })).toHaveProperty(
    'disabled',
    true,
  )
})
