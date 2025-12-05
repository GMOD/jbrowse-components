import { fireEvent } from '@testing-library/react'

import {
  createView,
  exportAndVerifySvg,
  hts,
  mockConsole,
  setupExportSvgTest,
} from './util'

// @ts-expect-error
global.indexedDB = {}

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setupExportSvgTest()

const delay = { timeout: 40000 }
const opts = [{}, delay]

async function testExportSvgWithError(tracks: string[], filename: string) {
  await mockConsole(async () => {
    const { view, findByTestId, findByText, findAllByText } = await createView()

    view.setNewView(0.1, 1)
    for (const track of tracks) {
      fireEvent.click(await findByTestId(hts(track), ...opts))
    }

    await findAllByText(/HTTP 404/, {}, delay)

    const svg = await exportAndVerifySvg({
      findByTestId,
      findByText,
      filename,
      delay,
    })
    expect(svg).toContain('Error')
  })
}

test('export svg with 404 alignment track', async () => {
  await testExportSvgWithError(
    ['volvox_alignments_bai_nonexist'],
    'lgv_error_alignment',
  )
}, 45000)

test('export svg with 404 wiggle track', async () => {
  await testExportSvgWithError(['volvox_bigwig_nonexist'], 'lgv_error_wiggle')
}, 45000)

test('export svg with mixed working and 404 tracks', async () => {
  await testExportSvgWithError(
    [
      'volvox_alignments_pileup_coverage',
      'volvox_alignments_bai_nonexist',
      'volvox_bigwig_nonexist',
    ],
    'lgv_error',
  )
}, 45000)
