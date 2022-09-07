import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

import {
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  createView,
  pc,
  hts,
} from './util'
import hicConfig from '../../../../extra_test_data/hic_integration_test.json'

setup()

const delay = { timeout: 20000 }

test('hic', async () => {
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url =>
        new LocalFile(require.resolve(`../../../../extra_test_data/${url}`)),
    ),
  )

  const { view, findByTestId } = createView(hicConfig)

  view.setNewView(5000, 0)
  fireEvent.click(await findByTestId(hts('hic_test'), {}, delay))
  expectCanvasMatch(await findByTestId(pc('{hg19}1:1..4,000,000-0'), {}, delay))
}, 25000)
