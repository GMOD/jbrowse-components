import path from 'path'
import { fireEvent } from '@testing-library/react'

// locals
import dotplotSessionFlipAxes from './dotplot_inverted_flipaxes.json'
import dotplotSession from './dotplot_inverted_test.json'
import { setup, doBeforeEach, expectCanvasMatch, createView } from './util'
import config from '../../test_data/config_dotplot.json'

const delay = { timeout: 25000 }
const opts = [{}, delay]

setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/${path.basename(url)}`))
})

test('open a dotplot view', async () => {
  const { findByTestId } = await createView(config)
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts))
}, 30000)

test('open a dotplot view with import form', async () => {
  const { findByTestId, findAllByTestId, findByText } = await createView(config)

  fireEvent.click(await findByTestId('close_view'))
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Dotplot view'))
  const inputBox = await findAllByTestId('assembly-selector')
  fireEvent.change(inputBox[0]!, {
    target: {
      value: 'peach',
    },
  })
  fireEvent.click(await findByText('New track', ...opts))
  fireEvent.change(await findByTestId('urlInput', ...opts), {
    target: {
      value: 'peach_grape_small.paf.gz',
    },
  })
  fireEvent.click(await findByText('Launch'))

  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts))
}, 30000)

test('inverted dotplot', async () => {
  const { findByTestId } = await createView({
    ...config,
    defaultSession: dotplotSession.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts), 0)
}, 30000)

test('inverted dotplot flip axes', async () => {
  const { findByTestId } = await createView({
    ...config,
    defaultSession: dotplotSessionFlipAxes.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts), 0)
}, 30000)

// session with dotplots and linear synteny views with both orientations tested
// http://localhost:3000/?config=test_data%2Fconfig_dotplot.json&session=share-GGmzKoxYlo&password=JhsC4
