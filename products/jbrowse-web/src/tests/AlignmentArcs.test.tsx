import { userEvent } from '@testing-library/user-event'

import { testLinkedReadsDisplay } from './testLinkedReadsDisplay.tsx'
import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 90000
const testArc = (loc: string, track: string) =>
  testLinkedReadsDisplay({
    loc,
    track,
    displayMode: 'arc',
    canvasId: 'arc-canvas',
    timeout: timeout - 5000,
  })

test(
  'short-read arc display',
  async () => {
    await testArc('ctgA:1-50000', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'long-read arc display',
  async () => {
    await testArc('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read arc display, full view',
  async () => {
    await testArc('ctgA:1..46,392', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read arc display, out of view pairing',
  async () => {
    await testArc('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
  },
  timeout,
)

test(
  'short-read arc display, out of view pairing',
  async () => {
    await testArc('ctgA:478..6,191', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'samplot mode draws flat |tlen| lines over coverage',
  async () => {
    const user = userEvent.setup()
    const { view, findByTestId, findByText } = await createView()
    const opts = [{}, { timeout: timeout - 5000 }] as const

    await view.navToLocString('ctgA:1-50000')
    await user.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
    await user.click(await findByTestId('track_menu_icon', ...opts))
    await user.click(await findByText('Read connections'))
    await user.click(await findByText('Paired arcs'))
    await user.click(await findByText('Samplot (discordant only)'))

    const display = await findByTestId('pileup-display-done', ...opts)
    await new Promise(res => setTimeout(res, 2000))
    expectCanvasMatch(findCanvasIn(display))
  },
  timeout,
)
