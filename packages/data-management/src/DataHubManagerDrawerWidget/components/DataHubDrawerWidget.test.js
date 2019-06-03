import {
  render,
  cleanup,
  fireEvent,
  // waitForElement,
} from 'react-testing-library'
import React from 'react'
import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import DataHubDrawerWidget from './DataHubDrawerWidget'

describe('<DataHubDrawerWidget />', () => {
  let model

  beforeAll(async () => {
    const { rootModel } = await createTestEnv({
      configId: 'testing',
      defaultSession: {},
      rpc: { configId: 'testingRpc' },
    })
    rootModel.addDrawerWidget('DataHubDrawerWidget', 'dataHubDrawerWidget')
    model = rootModel.drawerWidgets.get('dataHubDrawerWidget')
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<DataHubDrawerWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it.todo('Fix the tests below once react async testing stuff improves')

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
      return Promise.resolve(
        new Response(responseText, { url: 'http://test.com/hub.txt' }),
      )
    }
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    const { getByTestId /* , getByText */ } = render(
      <DataHubDrawerWidget model={model} />,
    )
    fireEvent.click(getByTestId('ucsc'))
    fireEvent.click(getByTestId('dataHubNext'))
    fireEvent.click(getByTestId('ucscCustom'))
    fireEvent.click(getByTestId('dataHubNext'))
    fireEvent.change(getByTestId('trackHubUrlInput'), {
      target: { value: 'http://test.com/hub.txt' },
    })
    fireEvent.click(getByTestId('trackHubUrlInputValidate'))
    // Next line doesn't work yet
    // await waitForElement(() => getByText('Assemblies'))

    // Do the rest of the UI actions to add the connection
  })

  xit('can handle Track Hub Registry hub', () => {})
})
