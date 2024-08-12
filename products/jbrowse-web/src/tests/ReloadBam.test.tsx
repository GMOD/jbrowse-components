import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import {
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  doBeforeEach,
  hts,
  createView,
  mockConsole,
  pv,
  mockFile404,
} from './util'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('reloads alignments track (BAI 404)', async () => {
  await mockConsole(async () => {
    mockFile404('volvox-sorted-altname.bam.bai', readBuffer)
    const { view, findByTestId, findAllByTestId, findAllByText } =
      await createView()
    view.setNewView(0.5, 0)
    fireEvent.click(await findByTestId(hts('volvox_bam_snpcoverage'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0]!)
    expectCanvasMatch(await findByTestId(pv('1..400-0'), ...opts))
  })
}, 40000)

test('reloads alignments track (BAM 404)', async () => {
  await mockConsole(async () => {
    mockFile404('volvox-sorted-altname.bam', readBuffer)
    const { view, findByTestId, findAllByTestId, findAllByText } =
      await createView()
    view.setNewView(0.5, 0)
    fireEvent.click(await findByTestId(hts('volvox_bam_pileup'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0]!)
    expectCanvasMatch(await findByTestId(pv('1..400-0'), ...opts))
  })
}, 40000)
