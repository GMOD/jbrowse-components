import React from 'react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { render, fireEvent } from '@testing-library/react'
import AddTrackWidget from './AddTrackWidget'
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

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

describe('<AddTrackWidget />', () => {
  it('adds a track', async () => {
    const { session, model } = getSession()
    const { getByTestId, getAllByTestId, findByText, findAllByText } = render(
      <AddTrackWidget model={model} />,
    )
    expect(session.sessionTracks.length).toBe(1)
    fireEvent.change(getAllByTestId('urlInput')[0]!, {
      target: { value: 'test.txt' },
    })
    fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)
    fireEvent.mouseDown(getByTestId('adapterTypeSelect'))
    const bamAdapter = await findByText('BAM adapter')
    fireEvent.click(bamAdapter)
    fireEvent.change(getByTestId('trackNameInput'), {
      target: { value: 'Test track name' },
    })
    fireEvent.mouseDown(getByTestId('trackTypeSelect'))
    fireEvent.click(await findByText('Feature track'))
    fireEvent.mouseDown(getByTestId('assemblyNameSelect'))
    fireEvent.click((await findAllByText('volMyt1'))[1]!)
    fireEvent.click(getAllByTestId('addTrackNextButton')[0]!)
    expect(session.sessionTracks.length).toBe(2)
  })
})
