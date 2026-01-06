import fs from 'fs'
import path from 'path'

import { fireEvent, waitFor } from '@testing-library/react'
import { saveAs } from 'file-saver-es'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
  setup,
} from './util.tsx'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of lgv', async () => {
  const { view, findByTestId, findByText } = await createView()

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  await exportAndVerifySvg({ findByTestId, findByText, filename: 'lgv', delay })
}, 45000)

test('export svg of lgv with gridlines', async () => {
  const { view, findByTestId, findByText } = await createView()

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))

  // Enable gridlines checkbox
  fireEvent.click(await findByText('Show gridlines', ...opts))

  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const svg = saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/lgv_gridlines_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)
