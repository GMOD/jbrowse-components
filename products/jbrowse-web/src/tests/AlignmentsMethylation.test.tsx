import path from 'path'

import { cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, test } from 'vitest'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'
import config from '../../test_data/methylation_test/config.json'

afterEach(() => {
  cleanup()
})
setup()

beforeEach(() => {
  doBeforeEach(url =>
    require.resolve(`../../test_data/methylation_test/${path.basename(url)}`),
  )
})

const delay = { timeout: 50000 }
const opts = [{}, delay]
test('color by methylation', async () => {
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
