import './svgExportMocks.ts'

import { saveAs } from '@jbrowse/core/util/FileSaver'
import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  hts,
  mockConsole,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

// A track whose data won't load fails the export instead of painting a red box
// into the figure. The dialog stays open with its error banner and saves
// nothing, which is the only outcome that can't end with a broken figure in
// somebody's paper — and, since a rendered error is absorbed by any golden
// regenerated while it is up, the only one that can't hide a real crash either.
async function testExportSvgFails(tracks: string[], expectedError: RegExp) {
  await mockConsole(async () => {
    const { view, findByTestId, findByText, findAllByText } = await createView(
      volvoxConfigWithTracks(tracks),
    )

    view.setNewView(0.1, 1)
    for (const track of tracks) {
      fireEvent.click(await findByTestId(hts(track), ...opts))
    }
    await findAllByText(/HTTP 404/, {}, delay)

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click((await findAllByText('Export SVG'))[0]!)
    fireEvent.click(await findByText('Submit', ...opts))

    // the dialog's own banner, not a rect inside a saved file
    await findByText(expectedError, {}, delay)
    await waitFor(() => {
      expect(saveAs).not.toHaveBeenCalled()
    }, delay)
  })
}

test('a 404 alignment track fails the export', async () => {
  await testExportSvgFails(
    ['volvox_alignments_bai_nonexist'],
    /Cannot export.*HTTP 404/,
  )
}, 45000)

test('a 404 wiggle track fails the export', async () => {
  await testExportSvgFails(
    ['volvox_bigwig_nonexist'],
    /Cannot export.*HTTP 404/,
  )
}, 45000)

// the mixed case is the one the old behavior looked most reasonable in — the
// working track rendered, so the export "worked" apart from a red box. It is
// still a figure with a hole in it, and the hole is the part you'd publish
test('one 404 among working tracks fails the whole export', async () => {
  await testExportSvgFails(
    [
      'volvox_alignments_pileup_coverage',
      'volvox_alignments_bai_nonexist',
      'volvox_bigwig_nonexist',
    ],
    /Cannot export.*HTTP 404/,
  )
}, 45000)
