import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from 'react-testing-library'
import React from 'react'
import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import AddConnectionDrawerWidget from './AddConnectionDrawerWidget'

describe('<AddConnectionDrawerWidget />', () => {
  let model
  let rootModel

  beforeAll(async () => {
    ;({ rootModel } = await createTestEnv({
      configId: 'testing',
      defaultSession: {},
      rpc: { configId: 'testingRpc' },
    }))
    rootModel.addDrawerWidget(
      'AddConnectionDrawerWidget',
      'addConnectionDrawerWidget',
    )
    model = rootModel.drawerWidgets.get('addConnectionDrawerWidget')
  })

  afterEach(cleanup)

  it('renders', () => {
    const { container } = render(<AddConnectionDrawerWidget model={model} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('can handle a custom UCSC trackHub URL', async () => {
    const {
      getByTestId,
      container,
      getAllByRole,
      getByText,
      getByValue,
    } = render(<AddConnectionDrawerWidget model={model} />)
    expect(
      rootModel.connections.has('Test UCSC connection name'),
    ).not.toBeTruthy()
    fireEvent.click(getAllByRole('button')[0])
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
    expect(rootModel.connections.has('Test UCSC connection name')).toBeTruthy()
  })

  it('can handle a custom JBrowse 1 data directory URL', async () => {
    const {
      getByTestId,
      container,
      getAllByRole,
      getByText,
      getByValue,
    } = render(<AddConnectionDrawerWidget model={model} />)
    expect(
      rootModel.connections.has('Test JBrowse 1 connection name'),
    ).not.toBeTruthy()
    fireEvent.click(getAllByRole('button')[0])
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
    expect(
      rootModel.connections.has('Test JBrowse 1 connection name'),
    ).toBeTruthy()
  })
})
