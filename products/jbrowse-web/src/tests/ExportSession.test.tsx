import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { saveAs } from 'file-saver-es'

let mockCounter = 0
jest.mock('@jbrowse/core/util/nanoid', () => ({
  nanoid: () => `test-id-${mockCounter++}`,
}))

import { createView, doBeforeEach, hts, setup } from './util'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({
  ...jest.requireActual('file-saver-es'),
  saveAs: jest.fn(),
}))

setup()

beforeEach(() => {
  mockCounter = 0
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('export session with alignments and gff tracks', async () => {
  const { view, findByTestId, findByText } = await createView()

  view.setNewView(0.5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )
  fireEvent.click(await findByTestId(hts('gff3tabix_genes'), ...opts))

  const user = userEvent.setup()
  await user.click(await findByText('File'))
  await user.click(await findByText('Export session'))

  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled()
  }, delay)

  const mock = saveAs as jest.Mock
  const blob = mock.mock.calls[0][0]
  const filename = mock.mock.calls[0][1]

  expect(filename).toBe('session.json')
  expect(blob.options.type).toBe('text/plain;charset=utf-8')

  const content = JSON.parse(blob.content[0])
  // Remove dynamic session name for snapshot stability (contains timestamp)
  delete content.session.name
  expect(content).toMatchSnapshot()
}, 40000)
