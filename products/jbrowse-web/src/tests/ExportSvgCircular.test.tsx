import fs from 'fs'
import path from 'path'

import { fireEvent, waitFor } from '@testing-library/react'
import FileSaver from 'file-saver-es'

import { createView, doBeforeEach, hts, setup } from './util'
import volvoxConfig from '../../test_data/volvox/config.json'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of circular', async () => {
  const { findByTestId, findByText } = await createView({
    ...volvoxConfig,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  // try opening a track before opening the actual view
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))

  // open a track selector for the circular view
  fireEvent.click(await findByTestId('circular_track_select', ...opts))

  // wait for the track selector to open and then click the
  // checkbox for the chord test track to toggle it on
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), ...opts))

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/circular_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)
