import React from 'react'
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from 'react-testing-library'
import { createTestEnv } from '../../../JBrowse'
import AddTrackDrawerWidget from './AddTrackDrawerWidget'

jest.mock('shortid', () => ({ generate: () => 'testid' }))

describe('<AddTrackDrawerWidget />', () => {
  let rootModel
  let model

  beforeAll(async () => {
    ;({ rootModel } = await createTestEnv({
      assemblies: {
        volvox: {
          configId: 'volvox',
          sequence: {
            type: 'ReferenceSequence',
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
        },
      },
    }))
    const view = rootModel.addView('LinearGenomeView')
    rootModel.addDrawerWidget('AddTrackDrawerWidget', 'addTrackDrawerWidget', {
      view: view.id,
    })
    model = rootModel.drawerWidgets.get('addTrackDrawerWidget')
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<AddTrackDrawerWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('adds a track', async () => {
    const { container, getByTestId, getByText, getAllByRole } = render(
      <AddTrackDrawerWidget model={model} />,
    )
    expect(rootModel.configuration.assemblies.get('volvox').tracks.length).toBe(
      1,
    )
    fireEvent.click(getByTestId('addTrackFromConfigRadio'))
    fireEvent.click(getByTestId('addTrackNextButton'))
    fireEvent.change(getByTestId('trackNameInput'), {
      target: { value: 'Test track name' },
    })
    fireEvent.click(getAllByRole('button')[0])
    await waitForElement(() => getByText('BasicTrack'), { container })
    fireEvent.click(getByText('BasicTrack'))
    fireEvent.click(getAllByRole('button')[1])
    await waitForElement(() => getByText('volvox'), { container })
    fireEvent.click(getByText('volvox'))
    fireEvent.click(getByTestId('addTrackNextButton'))
    expect(rootModel.configuration.assemblies.get('volvox').tracks.length).toBe(
      2,
    )
  })
})
