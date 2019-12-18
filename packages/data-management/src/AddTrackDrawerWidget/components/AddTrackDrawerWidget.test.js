import React from 'react'
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from '@testing-library/react'
import { createTestSession } from '@gmod/jbrowse-web/src/rootModel'
import AddTrackDrawerWidget from './AddTrackDrawerWidget'

describe('<AddTrackDrawerWidget />', () => {
  let session
  let model

  beforeAll(() => {
    session = createTestSession()
    session.addDataset({
      name: 'volvox',
      assembly: {
        name: 'volMyt1',
        sequence: {
          type: 'ReferenceSequenceTrack',
          adapter: {
            type: 'FromConfigAdapter',
            features: [
              {
                refName: 'ctgA',
                uniqueId: 'firstId',
                start: 0,
                end: 1000,
                seq:
                  'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctgaattgagaactcgagcgggggctaggcaaattctgattcagcctgacttctcttggaaccctgcccataaatcaaagggttagtgcggccaaaacgttggacaacggtattagaagaccaacctgaccaccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctccttggtcgctccgttgtacccaggctactttgaaagagcgcagaatacttagacggtatcgatcatggtagcatagcattctgataacatgtatggagttcgaacatccgtctggggccggacggtccgtttgaggttggttgatctgggtgatagtcagcaagatagacgttagataacaaattaaaggattttaccttagattgcgactagtacaacggtacatcggtgattcgcgctctactagatcacgctatgggtaccataaacaaacggtggaccttctcaagctggttgacgcctcagcaacataggcttcctcctccacgcatctcagcataaaaggcttataaactgcttctttgtgccagagcaactcaattaagcccttggtaccgtgggcacgcattctgtcacggtgaccaactgttcatcctgaatcgccgaatgggactatttggtacaggaatcaagcggatggcactactgcagcttatttacgacggtattcttaaagtttttaagacaatgtatttcatgggtagttcggtttgttttattgctacacaggctcttgtagacgacctacttagcactacgg',
              },
            ],
          },
        },
      },
      tracks: [
        {
          configId: 'i3jUPmrgMOS',
          type: 'FilteringTrack',
          name: 'Filter Test',
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
          renderer: {
            type: 'SvgFeatureRenderer',
            labels: {},
          },
          filterAttributes: ['type', 'start', 'end'],
        },
      ],
    })
    const view = session.addLinearGenomeViewOfDataset('volvox')
    model = session.addDrawerWidget(
      'AddTrackDrawerWidget',
      'addTrackDrawerWidget',
      { view: view.id },
    )
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<AddTrackDrawerWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('adds a track', async () => {
    const { getByTestId, getByText } = render(
      <AddTrackDrawerWidget model={model} />,
    )
    expect(session.datasets[0].tracks.length).toBe(1)
    fireEvent.click(getByTestId('addTrackFromConfigRadio'))
    fireEvent.click(getByTestId('addTrackNextButton'))
    fireEvent.change(getByTestId('trackNameInput'), {
      target: { value: 'Test track name' },
    })
    const trackTypeSelect = getByTestId('trackTypeSelect')
    fireEvent.click(trackTypeSelect)
    const basicTrack = await waitForElement(() => getByText('BasicTrack'))
    fireEvent.click(basicTrack)
    const datasetNameSelect = getByTestId('datasetNameSelect')
    fireEvent.click(datasetNameSelect)
    const volvox = await waitForElement(() => getByText('volvox'))
    fireEvent.click(volvox)
    fireEvent.click(getByTestId('addTrackNextButton'))
    expect(session.datasets[0].tracks.length).toBe(2)
  })
})
