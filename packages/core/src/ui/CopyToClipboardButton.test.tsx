import { cleanup, fireEvent, render } from '@testing-library/react'

import copy from '../util/copyToClipboard.ts'
import CopyToClipboardButton from './CopyToClipboardButton.tsx'

jest.mock('../util/copyToClipboard.ts', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const copyMock = copy as jest.MockedFunction<typeof copy>

afterEach(() => {
  cleanup()
  copyMock.mockClear()
})

// the feedback lands after the clipboard write resolves -- copyToClipboard only
// reports a rejected write by rejecting, so the label can't flash before then
test('copies a string value and shows feedback', async () => {
  const { getByRole, findByText } = render(
    <CopyToClipboardButton value="hello">Copy</CopyToClipboardButton>,
  )
  fireEvent.click(getByRole('button'))
  expect(copyMock).toHaveBeenCalledWith('hello')
  expect(await findByText('Copied to clipboard!')).toBeTruthy()
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

test('honors a custom copiedLabel', async () => {
  const { getByRole, findByText } = render(
    <CopyToClipboardButton value="x" copiedLabel="Done!">
      Copy
    </CopyToClipboardButton>,
  )
  fireEvent.click(getByRole('button'))
  expect(await findByText('Done!')).toBeTruthy()
})

test('a rejected clipboard write does not claim success', async () => {
  copyMock.mockRejectedValueOnce(new Error('denied'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { getByRole, findByText } = render(
    <CopyToClipboardButton value="x">Copy</CopyToClipboardButton>,
  )
  fireEvent.click(getByRole('button'))
  expect(await findByText('Copy')).toBeTruthy()
})
