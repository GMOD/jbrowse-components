import './svgExportMocks.ts'

import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  exportAndVerifySvg,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_test_vcf'])

beforeEach(() => {
  doBeforeEach()
})

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('opens a vcf track and clusters genotypes', async () => {
  const { view, findByTestId, findByText } = await createView(config)
  await view.navToLocString('ctgA:1-50000')

  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(
    await findByText('Multi-sample variant display (matrix)', ...opts),
  )

  // "Cluster rows by genotype..." is disabled until the display has its
  // samples — it needs two rows to reorder, and reads "Loading samples..."
  // before then — and a disabled MenuItem swallows the click, so opening the
  // menu first left this suite waiting on a dialog nothing had opened.
  await findDisplayPainted('variant-matrix-display', delay)

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Clustering', ...opts))
  fireEvent.click(await findByText('Cluster rows by genotype...', ...opts))

  const elt = await findByText('Run clustering', ...opts)
  await waitFor(() => {
    expect(elt).toHaveProperty('disabled', false)
  }, delay)
  fireEvent.click(elt)

  await waitFor(() => {
    expect(view.tracks[0].displays[0].hierarchy).toBeTruthy()
  }, delay)

  await findDisplayPainted('variant-matrix-display', delay)
  expectCanvasMatch(await findByTestId('variant_matrix_canvas', {}, delay))

  // export svg
  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'vcf_cluster',
  })
}, 90000)
