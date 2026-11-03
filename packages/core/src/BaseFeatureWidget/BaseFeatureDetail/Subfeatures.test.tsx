import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, within } from '@testing-library/react'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import { createJBrowseTheme } from '../../ui/index.ts'
import { stateModelFactory } from '../index.ts'
import BaseFeatureDetails from './index.tsx'

function exon(start: number, id: string, parent: string) {
  return {
    refName: 'ctgA',
    start,
    end: start + 10,
    type: 'exon',
    id,
    parent,
    exon_id: `ENSE_${id}`,
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
    subfeatures: [
      exon(0, 'e1', name),
      exon(40, 'e2', name),
      exon(80, 'e3', name),
    ],
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

test('a gene opens on a table of its transcripts, each summarising what it holds', () => {
  const { getByTestId } = renderGene(2)
  const rows = within(getByTestId('subfeature-group-mRNA')).getAllByRole('row')
  expect(rows.map(row => row.textContent)).toEqual([
    '#NamePositionLength',
    '1EDEN.13 exons1-100100',
    '2EDEN.23 exons1-100100',
  ])
})

test("opening a transcript row shows its exons 5′ to 3′, without the parent's tags", () => {
  const { getByTestId, getAllByRole } = renderGene(2)
  fireEvent.click(getAllByRole('button', { name: 'Show details' })[0]!)
  const exons = getByTestId('subfeature-group-exon')
  const rows = within(exons).getAllByRole('row')
  expect(rows.map(row => row.textContent)).toEqual([
    '#NamePositionLength',
    '1e381-9010',
    '2e241-5010',
    '3e11-1010',
  ])
  expect(within(exons).queryByText('parent')).toBeNull()

  fireEvent.click(
    within(exons).getAllByRole('button', { name: 'Show details' })[0]!,
  )
  expect(within(exons).getByText('ENSE_e3')).toBeTruthy()
})

test('a group draws its first hundred rows and offers the rest', () => {
  const { getByTestId, getByText } = renderGene(150)
  const group = getByTestId('subfeature-group-mRNA')
  expect(within(group).getAllByRole('row')).toHaveLength(101)
  fireEvent.click(getByText('Show all 150'))
  expect(within(group).getAllByRole('row')).toHaveLength(151)
})
