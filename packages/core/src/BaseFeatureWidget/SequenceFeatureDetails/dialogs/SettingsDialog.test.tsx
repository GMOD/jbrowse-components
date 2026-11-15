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
