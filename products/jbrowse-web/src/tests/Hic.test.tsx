import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  setup,
} from './util.tsx'
import hicConfig from '../../../../extra_test_data/hic_integration_test.json'

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../../../extra_test_data/${url}`))
})

setup()

const timeout = 30_000
const delay = { timeout }

test(
  'hic',
  async () => {
    const { view, findByTestId } = await createView(hicConfig)

    view.setNewView(5000, 0)
    fireEvent.click(await findByTestId(hts('hic_test'), {}, delay))
    expectCanvasMatch(await findByTestId('hic_canvas_done', {}, delay))
  },
  timeout,
)
