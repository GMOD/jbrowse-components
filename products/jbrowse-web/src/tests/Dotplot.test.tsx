import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { TextEncoder, TextDecoder } from 'web-encoding'
import path from 'path'
import dotplotConfig from '../../test_data/config_dotplot.json'
import dotplotSession from './dotplot_inverted_test.json'
import {
  setup,
  generateReadBuffer,
  expectCanvasMatch,
  createView,
} from './util'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}

const delay = { timeout: 25000 }

setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url =>
        new LocalFile(require.resolve(`../../test_data/${path.basename(url)}`)),
    ),
  )
})

test('open a dotplot view', async () => {
  const { findByTestId } = createView(dotplotConfig)
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 20000)

test('open a dotplot view with import form', async () => {
  const { findByTestId, findAllByTestId, findByText } =
    createView(dotplotConfig)

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
  fireEvent.change(await findByTestId('urlInput', {}, delay), {
    target: {
      value: 'peach_grape_small.paf.gz',
    },
  })
  fireEvent.click(await findByTestId('submitDotplot'))

  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 30000)

test('inverted dotplot', async () => {
  const { findByTestId } = createView({
    ...dotplotConfig,
    defaultSession: dotplotSession.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
})
