import { fireEvent } from '@testing-library/react'

import { createView, hts, setupTest, waitForCanvasSnapshot } from './util'

setupTest()

const delay = { timeout: 60000 }
const opts = [{}, delay] as const

test('open a multibigwig track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  await waitForCanvasSnapshot(findAllByTestId, 60000)
}, 60000)
