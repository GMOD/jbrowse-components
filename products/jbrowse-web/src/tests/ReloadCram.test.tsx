import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import {
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  doBeforeEach,
  hts,
  pv,
  createView,
  mockConsole,
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

// this tests reloading after an initial track error
// it performs a full image snapshot test to ensure that the features
// are rendered and not just that an empty canvas is rendered (empty
// canvas can result if ref name renaming failed)
test('reloads alignments track (CRAI 404)', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.cram.crai') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      await createView()
    await findByText('Help')
    view.setNewView(0.5, 0)
    fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(await findByTestId(pv('1..400-0'), ...opts))
  })
}, 20000)

test('reloads alignments track (CRAM 404)', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.cram') {
        return { status: 404 }
      }

      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      await createView()
    await findByText('Help')
    view.setNewView(0.5, 0)
    fireEvent.click(await findByTestId(hts('volvox_cram_snpcoverage'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(await findByTestId(pv('1..400-0'), ...opts))
  })
}, 20000)
