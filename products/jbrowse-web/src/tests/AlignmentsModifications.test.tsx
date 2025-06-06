import path from 'path'

import { within } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'
import config from '../../test_data/modifications_test/config.json'

setup()

beforeEach(() => {
  doBeforeEach(url =>
    require.resolve(`../../test_data/modifications_test/${path.basename(url)}`),
  )
})

const delay = { timeout: 50000 }
const opts = [{}, delay]
test('color by modifications', async () => {
  const { findByTestId } = await createView(config)

  const f1 = within(await findByTestId('Blockset-pileup'))
  const f2 = within(await findByTestId('Blockset-snpcoverage'))

  expectCanvasMatch(
    await f1.findByTestId(
      'prerendered_canvas_{hg38_clip}20:13433..13524-0_done',
      ...opts,
    ),
  )

  expectCanvasMatch(
    await f2.findByTestId(
      'prerendered_canvas_{hg38_clip}20:13433..13524-0_done',
      ...opts,
    ),
  )
}, 60000)
