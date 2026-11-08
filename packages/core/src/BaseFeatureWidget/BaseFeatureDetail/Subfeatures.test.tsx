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

test('a transcript groups its exons into one table, with what each exon has of its own on aligned lines under its row', () => {
  const exonWithNote = {
    ...exon(40, 2),
    experimental_evidence: ['RNA-seq', 'CAGE'],
  }
  const { getByTestId, queryByTestId } = renderGene([
    transcript('EDEN.1', {
      subfeatures: [exon(0, 3), exonWithNote, exon(80, 1)],
    }),
  ])
  expect(queryByTestId('transcript-select')).toBeNull()
  const exons = getByTestId('BaseCard-EDEN.1 · exon (3)')
  fireEvent.click(within(exons).getAllByRole('button')[0]!)

  const rows = within(exons).getAllByRole('row')
  expect(rows.map(row => row.textContent)).toEqual([
    '#PositionLength',
    '181-9010',
    'exon_number1',
    '241-5010',
    'exon_number2experimental_evidenceRNA-seqCAGE',
    '31-1010',
    'exon_number3',
  ])
  expect(within(exons).queryByText('Parent')).toBeNull()
  expect(within(exons).queryByText('source')).toBeNull()

  // one key column width for every part, so values line up down the card
  const grids = within(exons)
    .getAllByText('exon_number')
    .map(key => key.parentElement!.style.gridTemplateColumns)
  expect(new Set(grids)).toEqual(new Set(['21ch minmax(0px, 1fr)']))

  const evidence = within(exons).getByText(
    'experimental_evidence',
  ).nextElementSibling!
  expect(
    [...evidence.firstElementChild!.children].map(el => el.textContent),
  ).toEqual(['RNA-seq', 'CAGE'])
})

test('parts with nothing of their own get no lines under their rows', () => {
  const plain = transcript('EDEN.1', {
    subfeatures: [
      { refName: 'ctgA', start: 0, end: 10, type: 'exon' },
      { refName: 'ctgA', start: 40, end: 50, type: 'exon' },
    ],
  })
  const { getByTestId } = renderGene([plain])
  const exons = getByTestId('BaseCard-EDEN.1 · exon (2)')
  fireEvent.click(within(exons).getAllByRole('button')[0]!)
  expect(
    within(exons)
      .getAllByRole('row')
      .map(r => r.textContent),
  ).toEqual(['#PositionLength', '141-5010', '21-1010'])
})

test('a card shows its id as the data states it, even when it equals the name', () => {
  const { getByTestId } = renderGene([transcript('EDEN.1', { id: 'EDEN.1' })])
  const card = within(getByTestId('BaseCard-EDEN.1 · mRNA'))
  expect(card.getByText('id')).toBeTruthy()
  expect(card.getAllByText('EDEN.1').length).toBeGreaterThan(1)
})
