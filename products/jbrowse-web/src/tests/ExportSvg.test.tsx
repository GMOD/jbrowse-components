import { fireEvent, waitFor } from '@testing-library/react'
import { TextEncoder } from 'web-encoding'
import fs from 'fs'
import path from 'path'
import FileSaver from 'file-saver'

// locals
import { hts, createView, setup, doBeforeEach } from './util'

window.TextEncoder = TextEncoder

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))

// @ts-ignore
global.Blob = (content, options) => ({ content, options })

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 25000 }

test('export svg', async () => {
  console.error = jest.fn()
  const { view, findByTestId, findByText } = createView()

  await findByText('Help')
  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), {}, delay),
  )
  view.exportSvg()
  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), delay)

  // @ts-ignore
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 25000)
