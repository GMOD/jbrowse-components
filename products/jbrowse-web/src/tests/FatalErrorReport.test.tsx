import { suppressTeardownNoise } from '@jbrowse/display-test-utils'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

import packageJSON from '../../package.json' with { type: 'json' }
import LoaderWrapper from '../components/Loader.tsx'
import { handleRequest, volvoxGetFile } from './generateReadBuffer.ts'

import type { WebRootModel } from '../rootModel/rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  if (`${url}`.includes('plugin-store')) {
    return new Response(JSON.stringify({ plugins: [] }))
  }
  if (`${url}`.includes('jb2=true')) {
    return new Response('{}')
  }
  return handleRequest(() => volvoxGetFile(`${url}`), args)
})

const delay = { timeout: 20000 }

suppressTeardownNoise()

// A fatal error unmounts the app, which tears the rootModel down; the dialog
// that reports the error then outlives the session it was raised in. A user's
// report arrived as the dialog's own crash, "Failed to find the parent of
// AnonymousModel@/session [dead]", with the error that broke their session
// replaced by it and no version, URL or browser to go on.
test('the fatal error dialog reports the original error after teardown', async () => {
  const search = '?config=test_data/volvox/config_main_thread.json'
  window.history.replaceState(null, '', `${window.location.pathname}${search}`)
  jest.spyOn(console, 'error').mockImplementation(() => {})

  const {
    findByText,
    findByLabelText,
    findByTestId,
    getAllByTestId,
    queryByText,
  } = render(<LoaderWrapper initialTimestamp={Date.now()} />)
  await findByText('Help', {}, delay)
  const root = window.JBrowseRootModel as WebRootModel

  act(() => {
    root.setError(new Error('original failure'))
  })
  await findByText('Fatal error')
  await waitFor(() => {
    expect(isAlive(root)).toBe(false)
  })
  expect(window.JBrowseSession).toBeUndefined()

  const report = await findByTestId('error-report-text', {}, delay)
  expect(report.textContent).toContain('Error: original failure')
  expect(report.textContent).toContain('--- component stack ---')
  expect(report.textContent).toContain(`JBrowse ${packageJSON.version}`)

  fireEvent.click(await findByLabelText('Show stack trace'))
  await findByText('Stack trace', {}, delay)
  expect(queryByText(/Failed to find the parent/)).toBeNull()
  await waitFor(() => {
    expect(getAllByTestId('error-report-text').map(e => e.textContent)).toEqual(
      [
        expect.stringContaining('Error: original failure'),
        expect.stringContaining('Error: original failure'),
      ],
    )
  })
}, 30000)
