import '@testing-library/jest-dom'

jest.mock('@jbrowse/core/util/tracks', () => ({
  ...jest.requireActual('@jbrowse/core/util/tracks'),
  restoreFileHandlesFromSnapshot: jest.fn(),
  restoreFileHandles: jest.fn(),
}))

jest.mock('../makeWorkerInstance', () => () => {})

jest.mock('../util', () => ({
  ...jest.requireActual('../util'),
  reloadPage: jest.fn(),
}))

import { fireEvent, render, waitFor } from '@testing-library/react'
import {
  restoreFileHandles,
  restoreFileHandlesFromSnapshot,
} from '@jbrowse/core/util/tracks'
import { reloadPage } from '../util'

import { doBeforeEach, getPluginManager, JBrowse } from './util.tsx'

const mockReload = reloadPage as jest.Mock

const delay = { timeout: 15000 }

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

test('banner shows when file handles cannot be silently restored', async () => {
  ;(restoreFileHandlesFromSnapshot as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: false },
    { handleId: 'h2', success: false },
  ])

  const { pluginManager } = getPluginManager()
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)

  await findByText(/2 local files need permission/, {}, delay)
}, 15000)

test('no banner when file handles restore successfully', async () => {
  ;(restoreFileHandlesFromSnapshot as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: true },
  ])

  const { pluginManager } = getPluginManager()
  const { findByText, queryByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  await findByText('Help', {}, delay)
  expect(queryByText(/local file/)).not.toBeInTheDocument()
}, 15000)

test('restore access reloads page when all handles succeed', async () => {
  ;(restoreFileHandlesFromSnapshot as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: false },
  ])
  ;(restoreFileHandles as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: true },
  ])

  const { pluginManager } = getPluginManager()
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)

  await findByText(/1 local file needs permission/, {}, delay)
  fireEvent.click(await findByText('Restore access', {}, delay))

  await waitFor(() => expect(mockReload).toHaveBeenCalled(), delay)
}, 15000)

test('restore access reloads page on partial success', async () => {
  ;(restoreFileHandlesFromSnapshot as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: false },
    { handleId: 'h2', success: false },
  ])
  ;(restoreFileHandles as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: true },
    { handleId: 'h2', success: false },
  ])

  const { pluginManager } = getPluginManager()
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)

  await findByText(/2 local files need permission/, {}, delay)
  fireEvent.click(await findByText('Restore access', {}, delay))

  await waitFor(() => expect(mockReload).toHaveBeenCalled(), delay)
}, 15000)

test('no reload when restore fails completely', async () => {
  ;(restoreFileHandlesFromSnapshot as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: false },
  ])
  ;(restoreFileHandles as jest.Mock).mockResolvedValue([
    { handleId: 'h1', success: false },
  ])

  const { pluginManager } = getPluginManager()
  const { findByText } = render(<JBrowse pluginManager={pluginManager} />)

  await findByText(/1 local file needs permission/, {}, delay)
  fireEvent.click(await findByText('Restore access', {}, delay))

  // banner stays visible and no reload
  await findByText(/1 local file needs permission/, {}, delay)
  expect(mockReload).not.toHaveBeenCalled()
}, 15000)
