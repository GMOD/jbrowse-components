import React from 'react'
import { ThemeProvider } from '@emotion/react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import AddConnectionWidget2 from './AddConnectionWidget'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function AddConnectionWidget({ model }: { model: unknown }) {
  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <AddConnectionWidget2 model={model} />
    </ThemeProvider>
  )
}

function makeSession() {
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
  const model = session.addWidget('AddConnectionWidget', 'addConnectionWidget')
  return { model, session }
}

function renderWidget() {
  const user = userEvent.setup()
  const { model, session } = makeSession()
  const result = render(<AddConnectionWidget model={model} />)
  return { ...result, session, model, user }
}

test('renders', () => {
  const { container } = renderWidget()
  expect(container).toMatchSnapshot()
}, 20000)

test('can handle a custom UCSC trackHub URL', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (url: string | Request | URL) => {
      const urlText = `${url}`
      if (urlText.endsWith('hub.txt')) {
        return new Response(`hub TestHub
shortLabel Test Hub
longLabel Test Genome Informatics Hub for human DNase and RNAseq data
genomesFile genomes.txt
email genome@test.com
descriptionUrl test.html
`)
      } else if (urlText.endsWith('genomes.txt')) {
        return new Response(`genome volMyt1
trackDb hg19/trackDb.txt
`)
      } else if (urlText.endsWith('trackDb.txt')) {
        return new Response(`track dnaseSignal
bigDataUrl dnaseSignal.bigWig
shortLabel DNAse Signal
longLabel Depth of alignments of DNAse reads
type bigWig
`)
      }
      throw new Error('unknown')
    })

  const {
    session,
    user,
    findByText,
    getAllByRole,
    findAllByText,
    findByDisplayValue,
  } = renderWidget()
  expect(session.connections.length).toBe(0)
  await user.click(getAllByRole('combobox')[0]!)
  const ucscTrackHubSelection = await findAllByText('UCSC Track Hub')
  await user.click(ucscTrackHubSelection.at(-1)!)
  await user.click(await findByText('Next'))
  await user.type(
    await findByDisplayValue('nameOfConnection'),
    'Test UCSC connection name',
  )
  await user.type(
    await findByDisplayValue('http://mysite.com/path/to/hub.txt'),
    'http://test.com/hub.txt',
  )
  await user.click(await findByText('Connect'))
  expect(session.sessionConnections.length).toBe(1)
}, 20000)

test('can handle a custom JBrowse 1 data directory URL', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (url: RequestInfo | URL) => {
      const urlText = `${url}`
      let responseText = ''
      if (urlText.endsWith('trackList.json')) {
        responseText = '{}'
      } else if (urlText.endsWith('refSeqs.json')) {
        responseText = '[]'
      }
      return new Response(responseText)
    })

  const {
    findByTestId,
    getAllByRole,
    findByText,
    findByPlaceholderText,
    findByDisplayValue,
    user,
    session,
  } = renderWidget()
  expect(session.connections.length).toBe(0)
  await user.click(getAllByRole('combobox')[0]!)
  await user.click(await findByText('JBrowse 1 Data'))
  await user.click(await findByText('Next'))
  await user.type(await findByDisplayValue('nameOfConnection'), 'testing')
  await user.type(
    await findByDisplayValue('http://mysite.com/jbrowse/data/'),
    'http://test.com/jbrowse/data/',
  )
  await user.click(await findByText('Add item'))
  await user.type(await findByPlaceholderText('add new'), 'volMyt1')
  await user.click(await findByTestId('stringArrayAdd-assemblyNames'))
  await user.click(await findByText('Connect'))
  expect(session.sessionConnections.length).toBe(1)
}, 20000)
