import { act, render, within } from '@testing-library/react'

import FeatureSequenceDialog from './FeatureSequenceDialog.tsx'

import type { AbstractSessionModel } from '../../../util/index.ts'

const session = {} as AbstractSessionModel

const transcript = (name: string, end: number) => ({
  refName: 'chr1',
  start: 0,
  end,
  type: 'mRNA',
  name,
  subfeatures: [
    { refName: 'chr1', start: 0, end, type: 'exon' },
    { refName: 'chr1', start: 0, end, type: 'CDS' },
  ],
})

test('a gene opens on a coding transcript, with a selector for the others', async () => {
  const { getByTestId, getAllByRole } = render(
    <FeatureSequenceDialog
      feature={{
        uniqueId: 'g',
        refName: 'chr1',
        start: 0,
        end: 300,
        type: 'gene',
        subfeatures: [transcript('short', 150), transcript('long', 300)],
      }}
      session={session}
      assemblyName={undefined}
      handleClose={() => {}}
    />,
  )
  await act(async () => {})
  const selector = getByTestId('transcript-select')
  expect(within(selector).getByRole('combobox').textContent).toBe('long')
  expect(getAllByRole('combobox').map(el => el.textContent)).toContain('CDS')
})
