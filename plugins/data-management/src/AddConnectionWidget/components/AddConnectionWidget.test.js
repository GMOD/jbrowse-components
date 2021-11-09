import { render, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import AddConnectionWidget from './AddConnectionWidget'

window.fetch = jest.fn(() => new Promise(resolve => resolve()))

describe('<AddConnectionWidget />', () => {
  let model
  let session

  beforeEach(() => {
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
    model = session.addWidget('AddConnectionWidget', 'addConnectionWidget')
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<AddConnectionWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('can handle a custom UCSC trackHub URL', async () => {
    const mockFetch = url => {
      const urlText = url.href ? url.href : url
      let responseText = ''
      if (urlText.endsWith('hub.txt')) {
        responseText = `hub TestHub
shortLabel Test Hub
longLabel Test Genome Informatics Hub for human DNase and RNAseq data
genomesFile genomes.txt
email genome@test.com
descriptionUrl test.html
`
      } else if (urlText.endsWith('genomes.txt')) {
        responseText = `genome volMyt1
trackDb hg19/trackDb.txt
`
      } else if (urlText.endsWith('trackDb.txt')) {
        responseText = `track dnaseSignal
bigDataUrl dnaseSignal.bigWig
shortLabel DNAse Signal
longLabel Depth of alignments of DNAse reads
type bigWig
`
      }

      return Promise.resolve(new Response(responseText, { url: urlText }))
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const {
      findByTestId,
      getAllByRole,
      findAllByText,
      findByDisplayValue,
    } = render(<AddConnectionWidget model={model} />)
    expect(session.connections.length).toBe(0)
    fireEvent.mouseDown(getAllByRole('button')[0])
    const ucscTrackHubSelection = await findAllByText('UCSC Track Hub')
    fireEvent.click(ucscTrackHubSelection[ucscTrackHubSelection.length - 1])
    fireEvent.click(await findByTestId('addConnectionNext'))
    fireEvent.change(await findByDisplayValue('nameOfConnection'), {
      target: { value: 'Test UCSC connection name' },
    })
    fireEvent.change(
      await findByDisplayValue('http://mysite.com/path/to/hub.txt'),
      {
        target: { value: 'http://test.com/hub.txt' },
      },
    )
    fireEvent.click(await findByTestId('addConnectionNext'))
    expect(session.sessionConnections.length).toBe(1)
  })

  it('can handle a custom JBrowse 1 data directory URL', async () => {
    const mockFetch = url => {
      const urlText = url.href ? url.href : url
      let responseText = ''
      if (urlText.endsWith('trackList.json')) {
        responseText = '{}'
      } else if (urlText.endsWith('refSeqs.json')) {
        responseText = '[]'
      }
      return Promise.resolve(new Response(responseText, { url: urlText }))
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const {
      findByTestId,
      getAllByRole,
      findByPlaceholderText,
      findByText,
      findByDisplayValue,
    } = render(<AddConnectionWidget model={model} />)
    expect(session.connections.length).toBe(0)
    fireEvent.mouseDown(getAllByRole('button')[0])
    fireEvent.click(await findByText('JBrowse 1 Data'))
    fireEvent.click(await findByTestId('addConnectionNext'))
    fireEvent.change(await findByDisplayValue('nameOfConnection'), {
      target: { value: 'Test JBrowse 1 connection name' },
    })
    fireEvent.change(
      await findByDisplayValue('http://mysite.com/jbrowse/data/'),
      {
        target: { value: 'http://test.com/jbrowse/data/' },
      },
    )
    fireEvent.change(await findByPlaceholderText('add new'), {
      target: { value: 'volMyt1' },
    })
    fireEvent.click(await findByTestId('stringArrayAdd-assemblyNames'))
    fireEvent.click(await findByTestId('addConnectionNext'))
    expect(session.sessionConnections.length).toBe(1)
  })
})
