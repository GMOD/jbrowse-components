import path from 'path'

import dotplotSessionFlipAxes from './dotplot_inverted_flipaxes.json' with { type: 'json' }
import dotplotSession from './dotplot_inverted_test.json' with { type: 'json' }
import { createView, doBeforeEach, expectCanvasMatch, setup } from './util.tsx'
import config from '../../test_data/config_dotplot.json' with { type: 'json' }

const delay = { timeout: 50000 }
const opts = [{}, delay]

setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/${path.basename(url)}`))
})

test('open a dotplot view', async () => {
  const { findByTestId } = await createView(config)
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts))
}, 50000)

test('inverted dotplot', async () => {
  const { findByTestId } = await createView({
    ...config,
    defaultSession: dotplotSession.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts), 0)
}, 50000)

test('inverted dotplot flip axes', async () => {
  const { findByTestId } = await createView({
    ...config,
    defaultSession: dotplotSessionFlipAxes.session,
  })
  expectCanvasMatch(await findByTestId('prerendered_canvas_done', ...opts), 0)
}, 50000)

// session with dotplots and linear synteny views with both orientations tested
// http://localhost:3000/?config=test_data%2Fconfig_dotplot.json&session=share-GGmzKoxYlo&password=JhsC4
