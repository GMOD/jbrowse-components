import React from 'react'
import { TextEncoder } from 'web-encoding'
import { LocalFile } from 'generic-filehandle'
import fs from 'fs'
import path from 'path'
import FileSaver from 'file-saver'
import { JBrowse, setup, getPluginManager, generateReadBuffer } from './util'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { fireEvent, cleanup, render, waitFor } from '@testing-library/react'

window.TextEncoder = TextEncoder

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))
global.Blob = (content, options) => ({ content, options })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})

test('export svg', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_alignments_pileup_coverage'),
  )

  state.session.views[0].exportSvg()

  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), {
    timeout: 25000,
  })

  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 25000)
