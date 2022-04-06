import '@testing-library/jest-dom/extend-expect'
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import FatalErrorDialog from './FatalErrorDialog'

afterEach(cleanup)

test('open fatal error dialog in web', async () => {
  console.error = jest.fn()
  const { findByTestId, getByText } = render(
    <FatalErrorDialog
      resetButtonText="Reset Session"
      onFactoryReset={() => (
        <div>Placeholder for actual factory reset func</div>
      )}
    />,
  )
  expect(getByText('Reset Session')).toBeTruthy()
  fireEvent.click(await findByTestId('fatal-error'))
  expect(
    getByText(
      'Are you sure you want to reset? This will restore the default configuration.',
    ),
  ).toBeTruthy()
})

test('open fatal error dialog in desktop', async () => {
  console.error = jest.fn()
  const { findByTestId, getByText } = render(
    <FatalErrorDialog
      onFactoryReset={() => (
        <div>Placeholder for actual factory reset func</div>
      )}
    />,
  )
  expect(getByText('Factory Reset')).toBeTruthy()
  fireEvent.click(await findByTestId('fatal-error'))
  expect(
    getByText(
      'Are you sure you want to reset? This will restore the default configuration.',
    ),
  ).toBeTruthy()
})
