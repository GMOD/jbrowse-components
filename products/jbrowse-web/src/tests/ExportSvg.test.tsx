/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react'
import { TextEncoder } from 'web-encoding'
import { LocalFile } from 'generic-filehandle'
import fs from 'fs'
import path from 'path'
import FileSaver from 'file-saver'
import { createView, setup, generateReadBuffer } from './util'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

window.TextEncoder = TextEncoder

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))

// @ts-ignore
global.Blob = (content, options) => ({ content, options })

setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

test('export svg', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(
      'htsTrackEntry-volvox_alignments_pileup_coverage',
      {},
      { timeout: 10000 },
    ),
  )
  view.exportSvg()
  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), {
    timeout: 25000,
  })

  // @ts-ignore
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 25000)
