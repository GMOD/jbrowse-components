import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import PreferencesResetDialog from './PreferencesResetDialog.tsx'

import type { TrackConfigChange } from '@jbrowse/core/util'

function renderDialog(
  changes: TrackConfigChange[],
  onReset = () => {},
  onClose = () => {},
  onResetRow: (change: TrackConfigChange) => void = () => {},
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PreferencesResetDialog
        changes={changes}
        onReset={onReset}
        onResetRow={onResetRow}
        onClose={onClose}
      />
    </ThemeProvider>,
  )
}

test('lists each changed preference as a diff row', () => {
  const { getByText } = renderDialog([
    { path: ['animationMode'], from: 'enabled', to: 'disabled' },
    { path: ['theme'], from: 'default', to: 'lightStock' },
  ])
  expect(getByText('animationMode')).toBeTruthy()
  expect(getByText('disabled')).toBeTruthy()
  expect(getByText('lightStock')).toBeTruthy()
})

test('reset button confirms and closes', () => {
  const onReset = jest.fn()
  const onClose = jest.fn()
  const { getByRole } = renderDialog(
    [{ path: ['scrollZoom'], from: false, to: true }],
    onReset,
    onClose,
  )
  fireEvent.click(getByRole('button', { name: 'Reset to defaults' }))
  expect(onReset).toHaveBeenCalledTimes(1)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('per-row revert resets only that entry without closing', () => {
  const onReset = jest.fn()
  const onResetRow = jest.fn()
  const onClose = jest.fn()
  const changes: TrackConfigChange[] = [
    { path: ['animationMode'], from: 'enabled', to: 'disabled' },
    { path: ['theme'], from: 'default', to: 'lightStock' },
  ]
  const { getAllByRole } = renderDialog(changes, onReset, onClose, onResetRow)
  const revertButtons = getAllByRole('button', {
    name: 'Reset this preference',
  })
  expect(revertButtons).toHaveLength(2)
  fireEvent.click(revertButtons[0]!)
  expect(onResetRow).toHaveBeenCalledTimes(1)
  expect(onResetRow).toHaveBeenCalledWith(changes[0])
  expect(onReset).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

test('cancel closes without resetting', () => {
  const onReset = jest.fn()
  const onClose = jest.fn()
  const { getByRole } = renderDialog(
    [{ path: ['scrollZoom'], from: false, to: true }],
    onReset,
    onClose,
  )
  fireEvent.click(getByRole('button', { name: 'Cancel' }))
  expect(onReset).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('with no changes the reset action is disabled', () => {
  const onReset = jest.fn()
  const { getByRole, getByText } = renderDialog([], onReset)
  expect(
    getByText('All preferences are already at their defaults.'),
  ).toBeTruthy()
  const button = getByRole('button', { name: 'Reset to defaults' })
  expect(button).toHaveProperty('disabled', true)
  fireEvent.click(button)
  expect(onReset).not.toHaveBeenCalled()
})
