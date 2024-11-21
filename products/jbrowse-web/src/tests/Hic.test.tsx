import { fireEvent } from '@testing-library/react'

import {
  setup,
  doBeforeEach,
  expectCanvasMatch,
  createView,
  pc,
  hts,
} from './util'
import hicConfig from '../../../../extra_test_data/hic_integration_test.json'

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../../../extra_test_data/${url}`))
})

setup()

const delay = { timeout: 20000 }

test('hic', async () => {
  const { view, findByTestId } = await createView(hicConfig)

  view.setNewView(5000, 0)
  fireEvent.click(await findByTestId(hts('hic_test'), {}, delay))
  expectCanvasMatch(await findByTestId(pc('{hg19}1:1..4000000-0'), {}, delay))
}, 25000)
