import '@testing-library/jest-dom'

import { fireEvent } from '@testing-library/react'
import { beforeEach, test } from 'vitest'

import { createView, doBeforeEach, hts, setup } from './util'

setup()

const delay = { timeout: 30000 }

beforeEach(() => {
  doBeforeEach()
})

test('lollipop track test', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(1, 150)
  fireEvent.click(await findByTestId(hts('lollipop_track'), {}, delay))

  await findByTestId('display-lollipop_track_linear', {}, delay)
  await findByTestId('three', {}, delay)
}, 30000)
