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
} from './util'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('reloads alignments track (BAI 404)', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.bam.bai') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      createView()
    await findByText('Help')
    view.setNewView(0.5, 0)
    fireEvent.click(await findByTestId(hts('volvox_bam_snpcoverage'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(await findByTestId(pv('1..400-0'), ...opts))
  })
}, 20000)
test('reloads alignments track (BAM 404)', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.bam') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      createView()
    await findByText('Help')
    view.setNewView(0.5, 0)
    fireEvent.click(await findByTestId(hts('volvox_bam_pileup'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(await findByTestId(pv('1..400-0'), ...opts))
  })
}, 20000)
