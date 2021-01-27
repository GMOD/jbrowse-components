import React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import AddTrackWidget from './AddTrackWidget'

describe('<AddTrackWidget />', () => {
  let session
  let model

  beforeAll(() => {
    session = createTestSession()
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
              seq:
                'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctgaattgagaactcgagcgggggctaggcaaattctgattcagcctgacttctcttggaaccctgcccataaatcaaagggttagtgcggccaaaacgttggacaacggtattagaagaccaacctgaccaccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctccttggtcgctccgttgtacccaggctactttgaaagagcgcagaatacttagacggtatcgatcatggtagcatagcattctgataacatgtatggagttcgaacatccgtctggggccggacggtccgtttgaggttggttgatctgggtgatagtcagcaagatagacgttagataacaaattaaaggattttaccttagattgcgactagtacaacggtacatcggtgattcgcgctctactagatcacgctatgggtaccataaacaaacggtggaccttctcaagctggttgacgcctcagcaacataggcttcctcctccacgcatctcagcataaaaggcttataaactgcttctttgtgccagagcaactcaattaagcccttggtaccgtgggcacgcattctgtcacggtgaccaactgttcatcctgaatcgccgaatgggactatttggtacaggaatcaagcggatggcactactgcagcttatttacgacggtattcttaaagtttttaagacaatgtatttcatgggtagttcggtttgttttattgctacacaggctcttgtagacgacctacttagcactacgg',
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
    model = session.addWidget('AddTrackWidget', 'addTrackWidget', {
      view: view.id,
    })
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<AddTrackWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  xit('adds a track', async () => {
    const { getByTestId, findByText } = render(<AddTrackWidget model={model} />)
    expect(session.sessionTracks.length).toBe(1)
    fireEvent.click(getByTestId('addTrackNextButton'))
    fireEvent.change(getByTestId('trackNameInput'), {
      target: { value: 'Test track name' },
    })
    const trackTypeSelect = getByTestId('trackTypeSelect')
    fireEvent.mouseDown(trackTypeSelect)
    const featureTrack = await findByText('FeatureTrack')
    fireEvent.click(featureTrack)
    const assemblyNameSelect = getByTestId('assemblyNameSelect')
    fireEvent.mouseDown(assemblyNameSelect)
    const volMyt1 = await findByText('volMyt1')
    fireEvent.click(volMyt1)
    fireEvent.click(getByTestId('addTrackNextButton'))
    expect(session.sessionTracks.length).toBe(2)
  })
})
