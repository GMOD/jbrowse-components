import { render, within } from '@testing-library/react'

import { SequenceFeatureDetailsF } from '../model.ts'
import { sequenceModeNames, sequenceModes } from '../sequenceModes.ts'
import HelpDialog from './HelpDialog.tsx'

test('the help lists every sequence type under its selector label', () => {
  const model = SequenceFeatureDetailsF().create()
  model.setIntronBp(7)
  render(<HelpDialog model={model} handleClose={() => {}} />)
  const items = within(document.body)
    .getAllByRole('listitem')
    .map(el => el.textContent)
  expect(items).toHaveLength(sequenceModeNames.length)
  expect(items).toContain(
    `Genomic w/ 7bp intron: ${sequenceModes.gene_collapsed_intron.description}`,
  )
})
