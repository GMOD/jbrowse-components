import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90_000
const delay = { timeout }

test(
  'opens LD heatmap display from track menu',
  async () => {
    const { view, findByTestId, findByText } = await createView()
    const opts = [{}, delay] as const

    await view.navToLocString('ctgA')
    fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

    fireEvent.click(await findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await findByText('Display types', ...opts))
    fireEvent.click(await findByText('Linkage disequilibrium display', ...opts))

    expectCanvasMatch(await findByTestId('ld_canvas_done', ...opts))
  },
  timeout,
)
