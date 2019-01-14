import { createShallow } from '@material-ui/core/test-utils'
import React from 'react'
import HubSourceSelect from './HubSourceSelect'

describe('<HubSourceSelect />', () => {
  let shallow

  beforeAll(() => {
    shallow = createShallow()
  })

  it('renders', () => {
    const wrapper = shallow(
      <HubSourceSelect setHubSource={() => {}} enableNext={() => {}} />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('selects a hub source', () => {
    const setHubSource = jest.fn(event => event.target.value)
    const enableNext = jest.fn(() => true)
    const wrapper = shallow(
      <HubSourceSelect setHubSource={setHubSource} enableNext={enableNext} />,
    )
    wrapper
      .find('RadioGroup')
      .props()
      .onChange({ target: { value: 'ucscCustom' } })
    expect(setHubSource.mock.calls.length).toBe(1)
    expect(setHubSource.mock.results[0].value).toBe('ucscCustom')
    expect(enableNext.mock.calls.length).toBe(1)
    expect(enableNext.mock.results[0].value).toBe(true)
  })
})
