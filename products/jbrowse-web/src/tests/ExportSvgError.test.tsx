import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
  mockConsole,
  setup,
} from './util'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

// @ts-expect-error
global.indexedDB = {}

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg with 404 alignment track', async () => {
  await mockConsole(async () => {
    const { view, findByTestId, findByText, findAllByText } = await createView()

    view.setNewView(0.1, 1)
    fireEvent.click(
      await findByTestId(hts('volvox_alignments_bai_nonexist'), ...opts),
    )

    await findAllByText(/HTTP 404/, {}, delay)

    const svg = await exportAndVerifySvg({
      findByTestId,
      findByText,
      filename: 'lgv_error_alignment',
      delay,
    })
    expect(svg).toContain('Error')
  })
}, 45000)

test('export svg with 404 wiggle track', async () => {
  await mockConsole(async () => {
    const { view, findByTestId, findByText, findAllByText } = await createView()

    view.setNewView(0.1, 1)
    fireEvent.click(await findByTestId(hts('volvox_bigwig_nonexist'), ...opts))

    await findAllByText(/HTTP 404/, {}, delay)

    const svg = await exportAndVerifySvg({
      findByTestId,
      findByText,
      filename: 'lgv_error_wiggle',
      delay,
    })
    expect(svg).toContain('Error')
  })
}, 45000)

test('export svg with mixed working and 404 tracks', async () => {
  await mockConsole(async () => {
    const { view, findByTestId, findByText, findAllByText } = await createView()

    view.setNewView(0.1, 1)

    fireEvent.click(
      await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
    )
    fireEvent.click(
      await findByTestId(hts('volvox_alignments_bai_nonexist'), ...opts),
    )
    fireEvent.click(await findByTestId(hts('volvox_bigwig_nonexist'), ...opts))

    await findAllByText(/HTTP 404/, {}, delay)

    const svg = await exportAndVerifySvg({
      findByTestId,
      findByText,
      filename: 'lgv_error',
      delay,
    })
    expect(svg).toContain('Error')
  })
}, 45000)
