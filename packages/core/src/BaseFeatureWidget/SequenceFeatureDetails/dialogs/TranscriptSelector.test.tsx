import { fireEvent, render, within } from '@testing-library/react'

import TranscriptSelector from './TranscriptSelector.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'

function openedLabels(transcripts: SimpleFeatureSerialized[]) {
  const { container } = render(
    <TranscriptSelector
      transcripts={transcripts}
      transcriptIndex={0}
      setTranscriptIndex={() => {}}
    />,
  )
  fireEvent.mouseDown(within(container).getByRole('combobox'))
  return [
    ...document.body.querySelectorAll<HTMLElement>(
      '[data-testid^="transcript_"]',
    ),
  ].map(el => el.textContent)
}

const base = { refName: 'chr1', start: 0, end: 100, type: 'mRNA' }

test('names each transcript', () => {
  expect(
    openedLabels([
      { ...base, uniqueId: 'a', name: 'ENST1' },
      { ...base, uniqueId: 'b', id: 'ENST2' },
    ]),
  ).toEqual(['ENST1', 'ENST2'])
})

// getTranscripts pulls these off a gene's subfeatures, which carry neither a
// name nor an id often enough that both a literal "undefined" row and a blank
// one were reachable
test('numbers a transcript that carries no name or id', () => {
  expect(
    openedLabels([
      { ...base, uniqueId: 'a', name: '' },
      { ...base, uniqueId: 'b' },
    ]),
  ).toEqual(['Transcript 1', 'Transcript 2'])
})
