import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from 'react-testing-library'
import React from 'react'
import { createTestSession } from '@gmod/jbrowse-web/src/jbrowseModel'
import AddConnectionDrawerWidget from './AddConnectionDrawerWidget'

window.fetch = jest.fn(url => new Promise(resolve => resolve()))

describe('<AddConnectionDrawerWidget />', () => {
  let model
  let session

  beforeEach(() => {
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
    })
    model = session.addDrawerWidget(
      'AddConnectionDrawerWidget',
      'addConnectionDrawerWidget',
    )
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<AddConnectionDrawerWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('can handle a custom UCSC trackHub URL', async () => {
    const mockFetch = url => {
      const urlText = url.href ? url.href : url
      let responseText = ''
      if (urlText.endsWith('hub.txt'))
        responseText = `hub TestHub
shortLabel Test Hub
longLabel Test Genome Informatics Hub for human DNase and RNAseq data
genomesFile genomes.txt
email genome@test.com
descriptionUrl test.html
`
      else if (urlText.endsWith('genomes.txt'))
        responseText = `genome testAssembly
trackDb hg19/trackDb.txt
`
      else if (urlText.endsWith('trackDb.txt'))
        responseText = `track dnaseSignal
bigDataUrl dnaseSignal.bigWig
shortLabel DNAse Signal
longLabel Depth of alignments of DNAse reads
type bigWig
`

      return Promise.resolve(new Response(responseText, { url: urlText }))
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const {
      getByTestId,
      container,
      getAllByRole,
      getByText,
      getByValue,
    } = render(<AddConnectionDrawerWidget model={model} />)
    expect(session.datasets[0].connections.length).toBe(0)
    fireEvent.click(getAllByRole('button')[0])
    await waitForElement(() => getByText('volvox'), { container })
    fireEvent.click(getByText('volvox'))
    fireEvent.click(getAllByRole('button')[1])
    await waitForElement(() => getByText('UCSC Track Hub'), { container })
    fireEvent.click(getByText('UCSC Track Hub'))
    fireEvent.click(getByTestId('addConnectionNext'))
    fireEvent.change(getByValue('nameOfUCSCTrackHubConnection'), {
      target: { value: 'Test UCSC connection name' },
    })
    fireEvent.change(getByValue('http://mysite.com/path/to/hub.txt'), {
      target: { value: 'http://test.com/hub.txt' },
    })
    fireEvent.click(getByTestId('addConnectionNext'))
    expect(session.datasets[0].connections.length).toBe(1)
  })

  it('can handle a custom JBrowse 1 data directory URL', async () => {
    const mockFetch = url => {
      const urlText = url.href ? url.href : url
      let responseText = ''
      if (urlText.endsWith('trackList.json')) responseText = '{}'
      else if (urlText.endsWith('refSeqs.json')) responseText = '[]'
      return Promise.resolve(new Response(responseText, { url: urlText }))
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const {
      getByTestId,
      container,
      getAllByRole,
      getByText,
      getByValue,
    } = render(<AddConnectionDrawerWidget model={model} />)
    expect(session.datasets[0].connections.length).toBe(0)
    fireEvent.click(getAllByRole('button')[0])
    await waitForElement(() => getByText('volvox'), { container })
    fireEvent.click(getByText('volvox'))
    fireEvent.click(getAllByRole('button')[1])
    await waitForElement(() => getByText('JBrowse 1 Data'), { container })
    fireEvent.click(getByText('JBrowse 1 Data'))
    fireEvent.click(getByTestId('addConnectionNext'))
    fireEvent.change(getByValue('nameOfJBrowse1Connection'), {
      target: { value: 'Test JBrowse 1 connection name' },
    })
    fireEvent.change(getByValue('http://mysite.com/jbrowse/data/'), {
      target: { value: 'http://test.com/jbrowse/data/' },
    })
    fireEvent.click(getByTestId('addConnectionNext'))
    expect(session.datasets[0].connections.length).toBe(1)
  })
})
