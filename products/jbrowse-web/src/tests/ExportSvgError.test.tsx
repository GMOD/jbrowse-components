import fs from 'fs'
import path from 'path'

import { fireEvent, waitFor } from '@testing-library/react'
import { saveAs } from 'file-saver-es'

import { createView, doBeforeEach, hts, mockConsole, setup } from './util'

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

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(saveAs).toHaveBeenCalled()
    }, delay)

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const svg = saveAs.mock.calls[0][0].content[0]
    const dir = path.dirname(module.filename)
    fs.writeFileSync(
      `${dir}/__image_snapshots__/lgv_error_alignment_snapshot.svg`,
      svg,
    )
    expect(svg).toContain('Error')
    expect(svg).toMatchSnapshot()
  })
}, 45000)

test('export svg with 404 wiggle track', async () => {
  await mockConsole(async () => {
    const { view, findByTestId, findByText, findAllByText } = await createView()

    view.setNewView(0.1, 1)
    fireEvent.click(await findByTestId(hts('volvox_bigwig_nonexist'), ...opts))

    await findAllByText(/HTTP 404/, {}, delay)

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click(await findByText('Export SVG', ...opts))
    fireEvent.click(await findByText('Submit', ...opts))

    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(saveAs).toHaveBeenCalled()
    }, delay)

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const svg = saveAs.mock.calls[0][0].content[0]
    const dir = path.dirname(module.filename)
    fs.writeFileSync(
      `${dir}/__image_snapshots__/lgv_error_wiggle_snapshot.svg`,
      svg,
    )
    expect(svg).toContain('Error')
    expect(svg).toMatchSnapshot()
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

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click(await findByText('Export SVG', ...opts))
    fireEvent.click(await findByText('Submit', ...opts))

    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(saveAs).toHaveBeenCalled()
    }, delay)

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const svg = saveAs.mock.calls[0][0].content[0]
    const dir = path.dirname(module.filename)
    fs.writeFileSync(`${dir}/__image_snapshots__/lgv_error_snapshot.svg`, svg)
    expect(svg).toContain('Error')
    expect(svg).toMatchSnapshot()
  })
}, 45000)
