import '@testing-library/jest-dom'

import { fireEvent } from '@testing-library/react'

import { createView, hts, setupTest } from './util'

jest.mock('../makeWorkerInstance', () => () => {})

setupTest()

const delay = { timeout: 30000 }

test('lollipop track test', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(1, 150)
  fireEvent.click(await findByTestId(hts('lollipop_track'), {}, delay))

  await findByTestId('display-lollipop_track_linear', {}, delay)
  await findByTestId('three', {}, delay)
}, 30000)
