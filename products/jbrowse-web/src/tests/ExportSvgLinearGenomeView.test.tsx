import './svgExportMocks.ts'

import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_alignments_pileup_coverage'])

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of lgv', async () => {
  const { view, findByTestId, findByText } = await createView(config)

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  await exportAndVerifySvg({ findByTestId, findByText, filename: 'lgv', delay })
}, 45000)

// The route an agent takes: it has a path of its own to write to, and a
// download landing in ~/Downloads under a name it did not choose is a second
// file it cannot account for.
test('save: false returns the markup and writes nothing', async () => {
  const { saveAs } = jest.requireMock('@jbrowse/core/util/FileSaver') as {
    saveAs: jest.Mock
  }
  const { view, findByTestId } = await createView(config)

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  const markup = await view.exportSvg({ save: false })
  expect(markup).toContain('<svg')
  expect(saveAs).not.toHaveBeenCalled()
}, 45000)

test('export svg of lgv with gridlines', async () => {
  const { view, findByTestId, findByText } = await createView(config)

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'lgv_gridlines',
    delay,
    beforeSubmit: async () => {
      fireEvent.click(await findByText('Show gridlines', ...opts))
    },
  })
}, 45000)
