import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import {
  setup,
  generateReadBuffer,
  doBeforeEach,
  hts,
  createView,
  mockConsole,
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

test('reloads vcf (VCF.GZ 404)', async () => {
  await mockConsole(async () => {
    mockFile404('volvox.filtered.vcf.gz', readBuffer)
    const { view, findByTestId, findAllByTestId, findAllByText } =
      await createView()
    view.setNewView(0.05, 5000)
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0]!)

    await findAllByTestId('box-test-vcf-604453', ...opts)
  })
}, 40000)

test('reloads vcf (VCF.GZ.TBI 404)', async () => {
  await mockConsole(async () => {
    mockFile404('volvox.filtered.vcf.gz.tbi', readBuffer)
    const { view, findByTestId, findAllByTestId, findAllByText } =
      await createView()
    view.setNewView(0.05, 5000)
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-expect-error
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0]!)

    await findAllByTestId('box-test-vcf-604453', ...opts)
  })
}, 40000)
