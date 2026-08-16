import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { invokeIpc } from '../ipc.ts'
import OpenSequenceDialog from './OpenSequenceDialog.tsx'

// faidx runs in the main process; a plain FASTA is the one form that reaches it
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

const mockInvokeIpc = jest.mocked(invokeIpc)

function setup({
  existingAssemblyNames,
  onClose = jest.fn(async () => {}),
}: {
  existingAssemblyNames?: string[]
  onClose?: jest.Mock
} = {}) {
  const user = userEvent.setup()
  render(
    <OpenSequenceDialog
      onClose={onClose}
      existingAssemblyNames={existingAssemblyNames}
    />,
  )
  return { user, onClose }
}

// staging a genome resets the file inputs but leaves the pane on whichever
// source the user picked, so the toggle is only worth clicking the first time
async function enterUrls(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  if (!screen.queryByTestId('genome-urls')) {
    await user.click(screen.getByText('Open from a URL'))
  }
  await user.click(screen.getByTestId('genome-urls'))
  await user.paste(text)
}

const submit = () => screen.getByTestId('open-sequence-submit')

beforeEach(() => {
  mockInvokeIpc.mockReset()
  mockInvokeIpc.mockResolvedValue('/profile/fai/hg38.fa.fai')
})

test('opens a genome whose format needs no index', async () => {
  const { user, onClose } = setup()
  await enterUrls(user, 'https://example.com/hg38.2bit')
  await user.click(submit())

  expect(onClose).toHaveBeenCalledWith([
    expect.objectContaining({
      name: 'hg38',
      sequence: expect.objectContaining({
        adapter: expect.objectContaining({ type: 'TwoBitAdapter' }),
      }),
    }),
  ])
})

test('a format still missing its index cannot be submitted', async () => {
  const { user, onClose } = setup()
  await enterUrls(user, 'https://example.com/hg38.fa.gz')

  expect(screen.getByText(/needs its index file/)).toBeInTheDocument()
  expect(submit()).toBeDisabled()
  expect(onClose).not.toHaveBeenCalled()
})

test('a name already open is refused before faidx runs', async () => {
  const { user, onClose } = setup({ existingAssemblyNames: ['hg38'] })
  await enterUrls(user, 'https://example.com/hg38.fa')
  await user.click(submit())

  expect(await screen.findByText(/already open/)).toBeInTheDocument()
  expect(mockInvokeIpc).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

// the dialog used to open the staged list alone and drop this one on the floor
test('a half-entered genome below the staged list blocks the open', async () => {
  const { user, onClose } = setup()
  await enterUrls(user, 'https://example.com/hg38.2bit')
  await user.click(screen.getByRole('button', { name: 'Add another genome' }))
  expect(screen.getByText('hg38')).toBeInTheDocument()

  await enterUrls(user, 'https://example.com/mm39.fa.gz')
  await user.click(submit())

  expect(
    await screen.findByText(/Finish the genome you are adding/),
  ).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('an error clears as soon as the form is edited again', async () => {
  const { user } = setup({ existingAssemblyNames: ['hg38'] })
  await enterUrls(user, 'https://example.com/hg38.fa')
  await user.click(submit())
  expect(await screen.findByText(/already open/)).toBeInTheDocument()

  await user.clear(screen.getByTestId('assembly-name'))
  await user.type(screen.getByTestId('assembly-name'), 'hg38-copy')
  expect(screen.queryByText(/already open/)).not.toBeInTheDocument()
})

test('both staged genomes are handed over together', async () => {
  const { user, onClose } = setup()
  await enterUrls(user, 'https://example.com/hg38.2bit')
  await user.click(screen.getByRole('button', { name: 'Add another genome' }))
  await enterUrls(user, 'https://example.com/mm39.2bit')

  expect(submit()).toHaveTextContent('Open 2 genomes')
  await user.click(submit())

  expect(onClose).toHaveBeenCalledWith([
    expect.objectContaining({ name: 'hg38' }),
    expect.objectContaining({ name: 'mm39' }),
  ])
})
