import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { TextEncoder, TextDecoder } from 'web-encoding'

import dotplotConfig from '../../test_data/config_dotplot.json'
import {
  JBrowse,
  setup,
  generateReadBuffer,
  expectCanvasMatch,
  getPluginManager,
} from './util'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}
dotplotConfig.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

const delay = { timeout: 25000 }

expect.extend({ toMatchImageSnapshot })
setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/${url}`)),
    ),
  )
})

test('open a dotplot view', async () => {
  const pm = getPluginManager(dotplotConfig, false)
  const { findByTestId } = render(<JBrowse pluginManager={pm} />)
  expectCanvasMatch(await findByTestId('prerendered_canvas', {}, delay))
}, 20000)

test('open a dotplot view with import form', async () => {
  const pm = getPluginManager(dotplotConfig, false)
  const { findByTestId, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pm} />,
  )

  fireEvent.click(await findByTestId('close_view'))
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  const inputBox = await findAllByTestId('assembly-selector')
  fireEvent.change(inputBox[0], {
    target: {
      value: 'peach',
    },
  })
  fireEvent.change(await findByTestId('urlInput'), {
    target: {
      value: 'peach_grape_small.paf',
    },
  })
  fireEvent.click(await findByTestId('submitDotplot'))

  expectCanvasMatch(await findByTestId('prerendered_canvas', {}, delay))
}, 30000)
