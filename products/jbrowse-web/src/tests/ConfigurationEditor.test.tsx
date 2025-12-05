import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import { createView, hts, setupTest, waitForCanvasSnapshot } from './util'

jest.mock('../makeWorkerInstance', () => () => {})

setupTest()

const delay = { timeout: 30000 }

test('change color on track', async () => {
  const user = userEvent.setup()
  const {
    view,
    findByTestId,
    findByText,
    findByDisplayValue,
    findAllByTestId,
  } = await createView(undefined, true)

  view.setNewView(0.05, 5000)

  await user.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  await user.click(
    await findByTestId(
      'htsTrackEntryMenu-Tracks,volvox_filtered_vcf',
      {},
      delay,
    ),
  )
  await user.click(await findByText('Settings'))
  const elt = await findByDisplayValue('goldenrod', {}, delay)
  await user.clear(elt)
  await user.type(elt, 'green')

  await waitForCanvasSnapshot(findAllByTestId, 30000)
}, 40000)
