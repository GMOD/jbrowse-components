import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, waitFor, within } from '@testing-library/react'

import AddTrackWidget from './AddTrackWidget.tsx'
import ConfirmTrack from './ConfirmTrack.tsx'
import TextIndexingConfig from './TextIndexingConfig.tsx'
jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function getSession() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 1000,
            seq: 'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctgaattgagaactcgagcgggggctaggcaaattctgattcagcctgacttctcttggaaccctgcccataaatcaaagggttagtgcggccaaaacgttggacaacggtattagaagaccaacctgaccaccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctccttggtcgctccgttgtacccaggctactttgaaagagcgcagaatacttagacggtatcgatcatggtagcatagcattctgataacatgtatggagttcgaacatccgtctggggccggacggtccgtttgaggttggttgatctgggtgatagtcagcaagatagacgttagataacaaattaaaggattttaccttagattgcgactagtacaacggtacatcggtgattcgcgctctactagatcacgctatgggtaccataaacaaacggtggaccttctcaagctggttgacgcctcagcaacataggcttcctcctccacgcatctcagcataaaaggcttataaactgcttctttgtgccagagcaactcaattaagcccttggtaccgtgggcacgcattctgtcacggtgaccaactgttcatcctgaatcgccgaatgggactatttggtacaggaatcaagcggatggcactactgcagcttatttacgacggtattcttaaagtttttaagacaatgtatttcatgggtagttcggtttgttttattgctacacaggctcttgtagacgacctacttagcactacgg',
          },
        ],
      },
    },
  })
  session.addTrackConf({
    trackId: 'i3jUPmrgMOS',
    type: 'FeatureTrack',
    name: 'Filter Test',
    assemblyNames: ['volMyt1'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'one',
          refName: 'ctgA',
          start: 100,
          end: 101,
          type: 'foo',
          name: 'Boris',
          note: 'note for boris',
        },
        {
          uniqueId: 'two',
          refName: 'ctgA',
          start: 110,
          end: 111,
          type: 'bar',
          name: 'Theresa',
          note: 'note for theresa',
        },
        {
          uniqueId: 'three',
          refName: 'ctgA',
          start: 120,
          end: 121,
          type: 'baz',
          name: 'Nigel',
          note: 'note for nigel',
        },
        {
          uniqueId: 'four',
          refName: 'ctgA',
          start: 130,
          end: 131,
          type: 'quux',
          name: 'Geoffray',
          note: 'note for geoffray',
        },
      ],
    },
    filterAttributes: ['type', 'start', 'end'],
  })

  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  const model = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  return { session, model }
}

test('adds a track', async () => {
  const { session, model } = getSession()
  const { getByTestId, getByRole, getAllByTestId, findByText, findByRole } =
    render(<AddTrackWidget model={model} />)
  expect(session.sessionTracks.length).toBe(1)
  fireEvent.change(getAllByTestId('urlInput')[0]!, {
    target: {
      value: 'test.txt',
    },
  })
  fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)
  fireEvent.mouseDown(getByRole('combobox', { name: 'Adapter type' }))
  const bamAdapter = await findByText('BAM adapter')
  fireEvent.click(bamAdapter)
  fireEvent.change(getByTestId('trackNameInput'), {
    target: {
      value: 'Test track name',
    },
  })
  fireEvent.mouseDown(getByRole('combobox', { name: 'Track type' }))
  fireEvent.click(await findByText('Feature track'))
  fireEvent.mouseDown(getByRole('combobox', { name: 'Assembly' }))
  fireEvent.click(within(await findByRole('listbox')).getByText('volMyt1'))
  fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)
  expect(session.sessionTracks.length).toBe(2)
})

test('picking a non-configurable adapter keeps the dropdown (no dead-end)', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'test.txt', locationType: 'UriLocation' })
  // SplitVcfTabixAdapter is a real dropdown option with no single-file guesser
  // branch, so selecting it for an unrecognized file resolves to UNKNOWN
  model.setAdapterHint('SplitVcfTabixAdapter')
  const { getByRole, getByText } = render(<ConfirmTrack model={model} />)

  // the adapter dropdown is still rendered so the user can choose another,
  // rather than being stuck on a bare error message
  expect(getByRole('combobox', { name: 'Adapter type' })).toBeTruthy()
  expect(getByText(/could not be configured/i)).toBeTruthy()
})

test('can switch from the default workflow to the bulk workflow via the link', async () => {
  const { model } = getSession()
  const { getByText, findByText } = render(<AddTrackWidget model={model} />)
  // the link uses the shared BULK_WORKFLOW name; a mismatch would silently fall
  // back to the default workflow instead of opening the bulk one
  fireEvent.click(getByText('Add multiple tracks at once'))
  expect(await findByText(/Paste a list of file URLs/)).toBeTruthy()
})

test('synteny add-track component seeds query/target assemblies into the config', async () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'test.paf', locationType: 'UriLocation' })
  render(<ConfirmTrack model={model} />)

  // ComparativeAddTrackComponent is lazy; it seeds mixinData on mount so the
  // synteny adapter gets assemblies even without touching the pickers
  await waitFor(() => {
    expect(model.mixinData.adapter).toBeDefined()
  })
  expect(model.getTrackConfig(Date.now())?.adapter).toMatchObject({
    queryAssembly: 'volMyt1',
    targetAssembly: 'volMyt1',
  })
})

test('TextIndexingConfig edits existing values and has distinct add buttons', () => {
  const { model } = getSession()
  const { getByDisplayValue, getByTestId } = render(
    <TextIndexingConfig model={model} />,
  )

  // the two sections no longer share a testid
  expect(getByTestId('stringArrayAdd-attributes')).toBeTruthy()
  expect(getByTestId('stringArrayAdd-exclude')).toBeTruthy()

  // editing an existing attribute value writes back to the model (previously
  // the field had no onChange and was effectively read-only)
  fireEvent.change(getByDisplayValue('Name'), {
    target: { value: 'GeneName' },
  })
  expect(model.textIndexingConf?.attributes).toContain('GeneName')
})
