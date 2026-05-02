import { waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

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

const delay = { timeout: 60000 }
const opts = [{}, delay]

test(
  'MultiLGVSyntenyDisplay renders with GfaTabixAdapter',
  async () => {
    const user = userEvent.setup()
    const { view, findByTestId } = await createView()

    await view.navToLocString('ctgA:1-50000')

    await user.click(await findByTestId(hts('volvox_pangenome_50_gfa_tabix'), ...opts))

    await waitFor(
      () => {
        expect(view.initialized).toBe(true)
      },
      delay,
    )

    const canvas = await findByTestId('multi_synteny_canvas_done', ...opts)
    expectCanvasMatch(canvas)
  },
  90000,
)
