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
  session.addSessionTrackConf({
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

test('a whitespace-only name builds no config; a padded one is trimmed', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'test.bam', locationType: 'UriLocation' })

  model.setTrackName('   ')
  expect(model.getTrackConfig(1)).toBeUndefined()

  model.setTrackName('  Padded  ')
  const conf = model.getTrackConfig(1)
  expect(conf?.name).toBe('Padded')
  expect(conf?.trackId).toBe('padded-1')
})

test('emptying the track name leaves the field empty and blocks Add', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'test.bam', locationType: 'UriLocation' })
  const { getByTestId, getByText } = render(<ConfirmTrack model={model} />)
  const input = getByTestId('trackNameInput') as HTMLInputElement
  expect(input.value).toBe('test.bam')

  // it used to refill itself with the filename, which made the field
  // impossible to clear by backspacing
  fireEvent.change(input, { target: { value: '' } })
  expect(input.value).toBe('')
  expect(getByText('Enter a track name')).toBeTruthy()
})

test('the assembly dropdown survives a picker that contributes only its own fields', async () => {
  const { model } = getSession()
  // GWASAdapter has a picker (score column/transform) that does not ask for an
  // assembly. It used to be passed as the extension point's default component,
  // so claiming the point removed the assembly dropdown outright.
  model.setTrackData({
    uri: 'https://example.com/study.txt.gz',
    locationType: 'UriLocation',
  })
  expect(model.trackAdapter?.type).toBe('GWASAdapter')

  const { findByRole } = render(<ConfirmTrack model={model} />)
  expect(await findByRole('combobox', { name: 'Assembly' })).toBeTruthy()
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

test('TextIndexingConfig adds a trimmed value on Enter and de-duplicates', () => {
  const { model } = getSession()
  const { getAllByPlaceholderText } = render(
    <TextIndexingConfig model={model} />,
  )

  // the first "add new" field belongs to the attributes section
  const [attributesInput] = getAllByPlaceholderText('add new')

  // Enter adds the (trimmed) value rather than requiring the + button
  fireEvent.change(attributesInput!, { target: { value: '  Parent  ' } })
  fireEvent.keyDown(attributesInput!, { key: 'Enter' })
  expect(model.textIndexingConf?.attributes).toContain('Parent')

  // re-adding an existing value is a no-op rather than a duplicate entry
  fireEvent.change(attributesInput!, { target: { value: 'Parent' } })
  fireEvent.keyDown(attributesInput!, { key: 'Enter' })
  expect(
    model.textIndexingConf?.attributes.filter(
      (attr: string) => attr === 'Parent',
    ),
  ).toHaveLength(1)
})

// The extension guess is first-match-wins, so where two adapters read one
// extension the loser is reachable only by knowing its name in a dropdown of
// every adapter JBrowse has. A `.paf` resolves to the pairwise PAFAdapter, and
// an all-vs-all file read that way attributes one genome's contigs to another,
// so the form has to say the other reading exists — on the field, since nobody
// opens a dropdown they have no reason to think holds a better answer.
test('a file two adapters can read says so on the adapter field', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'all_vs_all.paf', locationType: 'UriLocation' })
  const { getByText } = render(<ConfirmTrack model={model} />)

  expect(
    getByText(/This file can also be read as.*All-vs-all PAF adapter/),
  ).toBeTruthy()
})

test('the alternative is also pulled to the top of the dropdown', async () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'all_vs_all.paf', locationType: 'UriLocation' })
  const { getByRole, findByRole } = render(<ConfirmTrack model={model} />)

  fireEvent.mouseDown(getByRole('combobox', { name: 'Adapter type' }))
  const listbox = within(await findByRole('listbox'))
  expect(listbox.getByText('Also reads this file')).toBeTruthy()
  // picking it re-guesses through the existing adapterHint path
  fireEvent.click(listbox.getAllByText('All-vs-all PAF adapter')[0]!)
  expect(model.trackAdapter?.type).toBe('AllVsAllPAFAdapter')
})

// the ordinary case, which is nearly every file: only a handful of adapters
// declare a pattern, and an unambiguous extension must not grow a second line
test('an unambiguous file says nothing extra', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'test.bam', locationType: 'UriLocation' })
  const { queryByText } = render(<ConfirmTrack model={model} />)

  expect(queryByText(/can also be read as/)).toBeNull()
})

// the adapter that IS the alternative must not offer itself
test('the chosen adapter is not listed as an alternative to itself', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'all_vs_all.paf', locationType: 'UriLocation' })
  model.setAdapterHint('AllVsAllPAFAdapter')
  const { queryByText } = render(<ConfirmTrack model={model} />)

  expect(queryByText(/can also be read as/)).toBeNull()
})

// .blocks is claimed by no guesser at all, so the file resolves to UNKNOWN.
// That path renders the prompt plus the dropdown, and is where naming the
// adapter matters most: there is otherwise nothing on screen pointing at it.
test('an unclaimed extension still names the adapter that reads it', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'grape.blocks', locationType: 'UriLocation' })
  const { getByText } = render(<ConfirmTrack model={model} />)

  expect(
    getByText(/can also be read as.*MCScan multi-genome blocks adapter/),
  ).toBeTruthy()
})

test('an all-vs-all PIF is offered alongside the pairwise guess', () => {
  const { model } = getSession()
  model.setTrackData({ uri: 'ava.pif.gz', locationType: 'UriLocation' })
  const { getByText } = render(<ConfirmTrack model={model} />)

  expect(model.trackAdapter?.type).toBe('PairwiseIndexedPAFAdapter')
  expect(
    getByText(/can also be read as.*All-vs-all indexed PAF adapter/),
  ).toBeTruthy()
})
