import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import {
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  doBeforeEach,
  hts,
  pc,
  createView,
} from './util'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }

// this tests reloading after an initial track error
// it performs a full image snapshot test to ensure that the features are rendered and not
// just that an empty canvas is rendered (empty canvas can result if ref name renaming failed)
test('reloads alignments track (CRAI 404)', async () => {
  console.error = jest.fn()

  // @ts-ignore
  fetch.mockResponse(async request => {
    if (request.url === 'volvox-sorted-altname.cram.crai') {
      return { status: 404 }
    }
    return readBuffer(request)
  })

  const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
    createView()
  await findByText('Help')
  view.setNewView(0.5, 0)
  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)

  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])
  expectCanvasMatch(await findByTestId(pc('{volvox}ctgA:1..400-0'), {}, delay))
}, 20000)

test('reloads alignments track (CRAM 404)', async () => {
  console.error = jest.fn()

  // @ts-ignore
  fetch.mockResponse(async request => {
    if (request.url === 'volvox-sorted-altname.cram') {
      return { status: 404 }
    }
    return generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    )(request)
  })

  const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
    createView()
  await findByText('Help')
  view.setNewView(0.5, 0)
  fireEvent.click(await findByTestId(hts('volvox_cram_snpcoverage'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)
  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])
  expectCanvasMatch(await findByTestId(pc('{volvox}ctgA:1..400-0'), {}, delay))
}, 20000)
test('reloads alignments track (BAI 404)', async () => {
  // @ts-ignore
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
  fireEvent.click(await findByTestId(hts('volvox_bam_snpcoverage'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)
  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])
  expectCanvasMatch(await findByTestId(pc('{volvox}ctgA:1..400-0'), {}, delay))
}, 20000)
test('reloads alignments track (BAM 404)', async () => {
  // @ts-ignore
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
  fireEvent.click(await findByTestId(hts('volvox_bam_pileup'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)

  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])
  expectCanvasMatch(await findByTestId(pc('{volvox}ctgA:1..400-0'), {}, delay))
}, 20000)

test('reloads bigwig (BW 404)', async () => {
  console.error = jest.fn()

  // @ts-ignore
  fetch.mockResponse(async request => {
    if (request.url === 'volvox_microarray.bw') {
      return { status: 404 }
    }
    return readBuffer(request)
  })

  const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
    createView()
  await findByText('Help')
  view.setNewView(10, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)
  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])
  expectCanvasMatch(
    await findByTestId(pc('{volvox}ctgA:1..8,000-0'), {}, delay),
  )
}, 20000)

test('reloads vcf (VCF.GZ 404)', async () => {
  console.error = jest.fn()

  // @ts-ignore
  fetch.mockResponse(async request => {
    if (request.url === 'volvox.filtered.vcf.gz') {
      return { status: 404 }
    }
    return readBuffer(request)
  })

  const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
    createView()
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)

  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])

  await findAllByTestId('box-test-vcf-604452', {}, delay)
}, 20000)

test('reloads vcf (VCF.GZ.TBI 404)', async () => {
  console.error = jest.fn()
  // @ts-ignore
  fetch.mockResponse(async request => {
    if (request.url === 'volvox.filtered.vcf.gz.tbi') {
      return { status: 404 }
    }
    return readBuffer(request)
  })

  const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
    createView()
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  await findAllByText(/HTTP 404/, {}, delay)
  // @ts-ignore
  fetch.mockResponse(readBuffer)
  const buttons = await findAllByTestId('reload_button')
  fireEvent.click(buttons[0])

  await findAllByTestId('box-test-vcf-604452', {}, delay)
}, 20000)
