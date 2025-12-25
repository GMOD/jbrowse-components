import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  exportAndVerifySvg,
  hts,
  setup,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})
// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('opens a vcf track and clusters genotypes', async () => {
  const { view, findAllByText, findByTestId, findByText, findAllByTestId } =
    await createView()
  await view.navToLocString('ctgA:1-50000')

  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (matrix)', ...opts),
  )

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Cluster by genotype', ...opts))

  const elt = await findByText('Run clustering', ...opts)
  await waitFor(() => {
    expect(elt).toHaveProperty('disabled', false)
  }, delay)
  fireEvent.click(elt)

  await waitFor(() => {
    expect(view.tracks[0].displays[0].hierarchy).toBeTruthy()
  }, delay)
  fireEvent.click((await findAllByText('Force load', ...opts))[0]!)

  expectCanvasMatch(
    (await findAllByTestId(/prerendered_canvas/, {}, delay))[0]!,
  )

  // export svg
  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'vcf_cluster',
  })
}, 90000)
