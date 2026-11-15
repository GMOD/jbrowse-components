import { act, fireEvent, render, waitFor, within } from '@testing-library/react'

import copyToClipboard from '../../util/copyToClipboard.ts'
import SequenceFeatureDetails from './SequenceFeatureDetails.tsx'
import { SequenceFeatureDetailsF } from './model.ts'
import { useTranscriptPick } from './useTranscriptPick.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'

jest.mock('../../util/copyToClipboard.ts', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('../../util/useFeatureSequence.ts', () => ({
  useFeatureSequence: () => ({
    sequence: { seq: 'ATGAAATAA', upstream: '', downstream: '' },
  }),
}))

const copyMock = copyToClipboard as jest.MockedFunction<typeof copyToClipboard>

const session = {
  notify: () => {},
  notifyError: () => {},
} as unknown as AbstractSessionModel

const transcript: SimpleFeatureSerialized = {
  uniqueId: 't',
  name: 'tx',
  refName: 'chr1',
  start: 0,
  end: 9,
  type: 'mRNA',
  subfeatures: [
    { refName: 'chr1', start: 0, end: 9, type: 'exon' },
    { refName: 'chr1', start: 0, end: 9, type: 'CDS' },
  ],
}

function Panel() {
  const pick = useTranscriptPick(transcript)
  return (
    <SequenceFeatureDetails
      model={SequenceFeatureDetailsF().create()}
      session={session}
      assemblyName={undefined}
      feature={transcript}
      transcriptPick={pick}
    />
  )
}

function clickMenuItem(scope: HTMLElement, label: string) {
  fireEvent.click(
    scope.querySelector('[data-testid="MoreVertIcon"]')!.closest('button')!,
  )
  fireEvent.click(within(document.body).getByRole('menuitem', { name: label }))
}

beforeEach(() => {
  localStorage.clear()
  copyMock.mockReset()
})

const fasta = '>tx-cds chr1:1-9\nATGAAATAA'

test('the inline panel and its dialog copy the same FASTA', async () => {
  const { container } = render(<Panel />)
  await act(async () => {})

  clickMenuItem(container, 'Copy FASTA')
  await waitFor(() => {
    expect(copyMock).toHaveBeenLastCalledWith(fasta, undefined)
  })

  clickMenuItem(container, 'Open in dialog')
  await act(async () => {})
  const dialog = within(document.body).getByRole('dialog')
  expect(within(dialog).getByText('ATGAAATAA')).toBeTruthy()

  clickMenuItem(dialog, 'Copy FASTA')
  await waitFor(() => {
    expect(copyMock).toHaveBeenCalledTimes(2)
  })
  expect(copyMock).toHaveBeenLastCalledWith(fasta, undefined)

  clickMenuItem(dialog, 'Copy HTML')
  await waitFor(() => {
    expect(copyMock).toHaveBeenCalledTimes(3)
  })
  const [html] = copyMock.mock.lastCall!
  expect(html).toMatch(/^<pre /)
  expect(html).not.toContain('overflow')
  expect(html).not.toContain('max-height')
})
