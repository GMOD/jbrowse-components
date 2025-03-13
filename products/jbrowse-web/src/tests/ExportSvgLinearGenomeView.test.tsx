import fs from 'fs'
import path from 'path'

import { fireEvent, waitFor } from '@testing-library/react'
import FileSaver from 'file-saver'

import { createView, doBeforeEach, hts, setup } from './util'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

setup()

beforeEach(() => {
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

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/lgv_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)
