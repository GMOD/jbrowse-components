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

test('reloads bigwig (BW 404)', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async request => {
      if (request.url === 'volvox_microarray.bw') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      await createView()
    await findByText('Help')
    view.setNewView(10, 0)
    fireEvent.click(await findByTestId(hts('volvox_microarray'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(await findByTestId(pv('1..8000-0'), ...opts))
  })
}, 20000)
