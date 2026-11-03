import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, within } from '@testing-library/react'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import { createJBrowseTheme } from '../../ui/index.ts'
import { stateModelFactory } from '../index.ts'
import BaseFeatureDetails from './index.tsx'

function exon(start: number, n: number) {
  return {
    refName: 'ctgA',
    start,
    end: start + 10,
    type: 'exon',
    ID: `e${n}`,
    Parent: 'tx1',
    source: 'test',
    exon_number: n,
  }
}

function transcript(name: string, extra = {}) {
  return {
    name,
    refName: 'ctgA',
    start: 0,
    end: 100,
    strand: -1,
    type: 'mRNA',
    source: 'test',
    subfeatures: [exon(0, 3), exon(40, 2), exon(80, 1)],
    ...extra,
  }
}

function renderGene(transcripts: ReturnType<typeof transcript>[]) {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
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
          subfeatures: transcripts,
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

const threeTranscripts = () => [
  transcript('EDEN.1'),
  transcript('EDEN.2', { tag: 'MANE Select' }),
  transcript('EDEN.3', { end: 200 }),
]

function openMenu(combobox: HTMLElement) {
  fireEvent.mouseDown(combobox)
  return within(document.body)
    .getAllByRole('option')
    .map(option => option.textContent)
}

test('a gene shows its best-ranked transcript, picked from a menu in rank order', () => {
  const { getByTestId, queryByTestId, getByText } =
    renderGene(threeTranscripts())
  expect(getByTestId('BaseCard-EDEN.2 · mRNA')).toBeTruthy()
  expect(queryByTestId('BaseCard-EDEN.1 · mRNA')).toBeNull()
  expect(queryByTestId('BaseCard-EDEN.3 · mRNA')).toBeNull()

  const select = within(getByTestId('transcript-select')).getByRole('combobox')
  expect(select.textContent).toBe('EDEN.2')
  expect(
    getByText('Transcript (1 of 3)', { selector: '.MuiInputLabel-root' }),
  ).toBeTruthy()
  expect(openMenu(select)).toEqual(['EDEN.2', 'EDEN.3', 'EDEN.1'])
  fireEvent.click(within(document.body).getByRole('option', { name: 'EDEN.1' }))

  expect(getByTestId('BaseCard-EDEN.1 · mRNA')).toBeTruthy()
  expect(queryByTestId('BaseCard-EDEN.2 · mRNA')).toBeNull()
  expect(
    getByText('Transcript (3 of 3)', { selector: '.MuiInputLabel-root' }),
  ).toBeTruthy()
})

test('the sequence panel reads the same pick as the Subfeatures menu', async () => {
  const { getByRole, getAllByTestId } = renderGene(threeTranscripts())
  fireEvent.click(getByRole('button', { name: 'Show feature sequence' }))
  await act(async () => {})
  const selects = () =>
    getAllByTestId('transcript-select').map(el =>
      within(el).getByRole('combobox'),
    )
  expect(selects().map(s => s.textContent)).toEqual(['EDEN.2', 'EDEN.2'])

  fireEvent.mouseDown(selects()[1]!)
  fireEvent.click(within(document.body).getByRole('option', { name: 'EDEN.3' }))
  await act(async () => {})
  expect(selects().map(s => s.textContent)).toEqual(['EDEN.3', 'EDEN.3'])
})

test('a transcript groups its exons into one table, with what each exon has of its own under its row', () => {
  const { getByTestId, queryByTestId } = renderGene([transcript('EDEN.1')])
  expect(queryByTestId('transcript-select')).toBeNull()
  const exons = getByTestId('BaseCard-exon (3)')
  fireEvent.click(within(exons).getAllByRole('button')[0]!)

  const rows = within(exons).getAllByRole('row')
  expect(rows.map(row => row.textContent)).toEqual([
    '#PositionLength',
    '181-9010',
    'exon_number1',
    '241-5010',
    'exon_number2',
    '31-1010',
    'exon_number3',
  ])
  expect(within(exons).queryByText('Parent')).toBeNull()
  expect(within(exons).queryByText('source')).toBeNull()
})
