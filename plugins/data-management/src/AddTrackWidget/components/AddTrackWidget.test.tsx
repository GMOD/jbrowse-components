import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import AddTrackWidget from './AddTrackWidget'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function getSession() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      adapter: {
        features: [
          {
            end: 1000,
            refName: 'ctgA',
            seq: 'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctgaattgagaactcgagcgggggctaggcaaattctgattcagcctgacttctcttggaaccctgcccataaatcaaagggttagtgcggccaaaacgttggacaacggtattagaagaccaacctgaccaccaaaccgtcaattaaccggtatcttctcggaaacggcggttctctcctagatagcgatctgtggtctcaccatgcaatttaaacaggtgagtaaagattgctacaaatacgagactagctgtcaccagatgctgttcatctgttggctccttggtcgctccgttgtacccaggctactttgaaagagcgcagaatacttagacggtatcgatcatggtagcatagcattctgataacatgtatggagttcgaacatccgtctggggccggacggtccgtttgaggttggttgatctgggtgatagtcagcaagatagacgttagataacaaattaaaggattttaccttagattgcgactagtacaacggtacatcggtgattcgcgctctactagatcacgctatgggtaccataaacaaacggtggaccttctcaagctggttgacgcctcagcaacataggcttcctcctccacgcatctcagcataaaaggcttataaactgcttctttgtgccagagcaactcaattaagcccttggtaccgtgggcacgcattctgtcacggtgaccaactgttcatcctgaatcgccgaatgggactatttggtacaggaatcaagcggatggcactactgcagcttatttacgacggtattcttaaagtttttaagacaatgtatttcatgggtagttcggtttgttttattgctacacaggctcttgtagacgacctacttagcactacgg',
            start: 0,
            uniqueId: 'firstId',
          },
        ],
        type: 'FromConfigSequenceAdapter',
      },
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
    },
  })
  session.addTrackConf({
    adapter: {
      features: [
        {
          end: 101,
          name: 'Boris',
          note: 'note for boris',
          refName: 'ctgA',
          start: 100,
          type: 'foo',
          uniqueId: 'one',
        },
        {
          end: 111,
          name: 'Theresa',
          note: 'note for theresa',
          refName: 'ctgA',
          start: 110,
          type: 'bar',
          uniqueId: 'two',
        },
        {
          end: 121,
          name: 'Nigel',
          note: 'note for nigel',
          refName: 'ctgA',
          start: 120,
          type: 'baz',
          uniqueId: 'three',
        },
        {
          end: 131,
          name: 'Geoffray',
          note: 'note for geoffray',
          refName: 'ctgA',
          start: 130,
          type: 'quux',
          uniqueId: 'four',
        },
      ],
      type: 'FromConfigAdapter',
    },
    assemblyNames: ['volMyt1'],
    filterAttributes: ['type', 'start', 'end'],
    name: 'Filter Test',
    trackId: 'i3jUPmrgMOS',
    type: 'FeatureTrack',
  })

  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        end: 1000,
        refName: 'ctgA',
        start: 0,
      },
    ],
  })

  const model = session.addWidget('AddTrackWidget', 'addTrackWidget', {
    view: view.id,
  })
  return { model, session }
}

describe('<AddTrackWidget />', () => {
  it('adds a track', async () => {
    const { session, model } = getSession()
    const { getByTestId, getAllByTestId, findByText, findAllByText } = render(
      <AddTrackWidget model={model} />,
    )
    expect(session.sessionTracks.length).toBe(1)
    fireEvent.change(getAllByTestId('urlInput')[0], {
      target: { value: 'test.txt' },
    })
    fireEvent.click(getAllByTestId('addTrackNextButton')[0])
    fireEvent.mouseDown(getByTestId('adapterTypeSelect'))
    const bamAdapter = await findByText('BAM adapter')
    fireEvent.click(bamAdapter)
    fireEvent.change(getByTestId('trackNameInput'), {
      target: { value: 'Test track name' },
    })
    fireEvent.mouseDown(getByTestId('trackTypeSelect'))
    fireEvent.click(await findByText('Feature track'))
    fireEvent.mouseDown(getByTestId('assemblyNameSelect'))
    fireEvent.click((await findAllByText('volMyt1'))[1])
    fireEvent.click(getAllByTestId('addTrackNextButton')[0])
    expect(session.sessionTracks.length).toBe(2)
  })
})
