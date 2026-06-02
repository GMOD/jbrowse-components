import { cleanup, fireEvent, render } from '@testing-library/react'
import copy from 'copy-to-clipboard'

import CopyToClipboardButton from './CopyToClipboardButton.tsx'

jest.mock('copy-to-clipboard', () => ({ __esModule: true, default: jest.fn() }))

const copyMock = copy as jest.MockedFunction<typeof copy>

afterEach(() => {
  cleanup()
  copyMock.mockClear()
})

test('copies a string value and shows feedback', () => {
  const { getByRole, getByText } = render(
    <CopyToClipboardButton value="hello">Copy</CopyToClipboardButton>,
  )
  fireEvent.click(getByRole('button'))
  expect(copyMock).toHaveBeenCalledWith('hello')
  expect(getByText('Copied to clipboard!')).toBeTruthy()
})

test('defers a function value until the click', () => {
  const value = jest.fn(() => 'computed')
  const { getByRole } = render(
    <CopyToClipboardButton value={value}>Copy</CopyToClipboardButton>,
  )
  expect(value).not.toHaveBeenCalled()
  fireEvent.click(getByRole('button'))
  expect(value).toHaveBeenCalledTimes(1)
  expect(copyMock).toHaveBeenCalledWith('computed')
})

test('honors a custom copiedLabel', () => {
  const { getByRole, getByText } = render(
    <CopyToClipboardButton value="x" copiedLabel="Done!">
      Copy
    </CopyToClipboardButton>,
  )
  fireEvent.click(getByRole('button'))
  expect(getByText('Done!')).toBeTruthy()
})
