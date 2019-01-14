import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import HubTypeSelect from './HubTypeSelect'

describe('<HubTypeSelect />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const wrapper = shallow(
      <HubTypeSelect setHubType={() => {}} enableNext={() => {}} />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('selects a hub type', () => {
    const setHubType = jest.fn(event => event.target.value)
    const enableNext = jest.fn(() => true)
    const wrapper = shallow(
      <HubTypeSelect setHubType={setHubType} enableNext={enableNext} />,
    )
    wrapper
      .find('RadioGroup')
      .props()
      .onChange({ target: { value: 'ucsc' } })
    expect(setHubType.mock.calls.length).toBe(1)
    expect(setHubType.mock.results[0].value).toBe('ucsc')
    expect(enableNext.mock.calls.length).toBe(1)
    expect(enableNext.mock.results[0].value).toBe(true)
  })
})
