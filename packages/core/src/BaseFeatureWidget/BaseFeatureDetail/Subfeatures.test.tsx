import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, within } from '@testing-library/react'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import { createJBrowseTheme } from '../../ui/index.ts'
import { stateModelFactory } from '../index.ts'
import BaseFeatureDetails from './index.tsx'

function exon(start: number, id: string) {
  return {
    refName: 'ctgA',
    start,
    end: start + 10,
    type: 'exon',
    ID: id,
    Parent: 'tx1',
  }
}

function renderGene(transcripts: number) {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const transcript = (name: string) => ({
    name,
    refName: 'ctgA',
    start: 0,
    end: 100,
    strand: -1,
    type: 'mRNA',
    subfeatures: [exon(0, 'e1'), exon(40, 'e2'), exon(80, 'e3')],
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'g',
          name: 'EDEN',
          refName: 'ctgA',
          start: 0,
          end: 100,
          type: 'gene',
          subfeatures: Array.from({ length: transcripts }, (_, i) =>
            transcript(`EDEN.${i + 1}`),
          ),
        },
      },
    },
    { pluginManager },
  )
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
}

test('a gene lists its transcripts collapsed, and a transcript groups its exons into one table', () => {
  const { getByTestId, queryByTestId } = renderGene(2)
  expect(getByTestId('BaseCard-EDEN.2 - mRNA')).toBeTruthy()
  expect(queryByTestId('BaseCard-exon (3)')).toBeNull()

  fireEvent.click(
    within(getByTestId('BaseCard-EDEN.1 - mRNA')).getAllByRole('button')[0]!,
  )
  const exons = getByTestId('BaseCard-exon (3)')
  fireEvent.click(within(exons).getAllByRole('button')[0]!)

  const rows = within(exons).getAllByRole('row')
  expect(rows.map(row => row.textContent)).toEqual([
    '#PositionLengthID',
    '181-9010e3',
    '241-5010e2',
    '31-1010e1',
  ])
  expect(within(exons).getByText('Parent')).toBeTruthy()
})

test('a gene with one transcript opens it', () => {
  const { getByTestId } = renderGene(1)
  expect(getByTestId('BaseCard-exon (3)')).toBeTruthy()
})
