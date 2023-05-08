import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import {
  setup,
  generateReadBuffer,
  doBeforeEach,
  hts,
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

const delay = { timeout: 5000 }
const opts = [{}, delay]

test('reloads vcf', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async request => {
      return request.url === 'volvox.filtered.vcf.gz'
        ? { status: 404 }
        : readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      await createView()
    await findByText('Help')
    view.setNewView(0.05, 5000)
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])

    await findAllByTestId('box-test-vcf-604453', ...opts)
  })
}, 50000)

test('reloads tbi', async () => {
  await mockConsole(async () => {
    // @ts-expect-error
    fetch.mockResponse(async r => {
      return r.url === 'volvox.filtered.vcf.gz.tbi'
        ? { status: 404 }
        : readBuffer(r)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      await createView()
    await findByText('Help')
    view.setNewView(0.05, 5000)
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])

    await findAllByTestId('box-test-vcf-604453', ...opts)
  })
}, 50000)
