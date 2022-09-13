import { fireEvent } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { TextEncoder, TextDecoder } from 'web-encoding'
import path from 'path'

// locals
import config from '../../test_data/config_dotplot.json'
import dotplotSession from './dotplot_inverted_test.json'
import dotplotSessionFlipAxes from './dotplot_inverted_flipaxes.json'
import { setup, doBeforeEach, expectCanvasMatch, createView } from './util'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}

const delay = { timeout: 25000 }

expect.extend({ toMatchImageSnapshot })
setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/${path.basename(url)}`))
})

test('open a dotplot view', async () => {
  const { findByTestId } = createView(config)
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay))
}, 20000)

test('open a dotplot view with import form', async () => {
  const { findByTestId, findAllByTestId, findByText } = createView(config)

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
    ...config,
    defaultSession: dotplotSession.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay), 0)
}, 30000)

test('inverted dotplot flip axes', async () => {
  const { findByTestId } = createView({
    ...config,
    defaultSession: dotplotSessionFlipAxes.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', {}, delay), 0)
}, 30000)

// session with dotplots and linear synteny views with both orientations tested
// http://localhost:3000/?config=test_data%2Fconfig_dotplot.json&session=share-GGmzKoxYlo&password=JhsC4
