import { createShallow, createMount } from '@material-ui/core/test-utils'
import React from 'react'
import TrackSourceSelect from './TrackSourceSelect'

describe('<TrackSourceSelect />', () => {
  let shallow
  let mount

  beforeAll(() => {
    shallow = createShallow()
    mount = createMount()
  })

  it('shallowly renders', () => {
    const wrapper = shallow(
      <TrackSourceSelect
        trackSource="fromFile"
        updateTrackSource={() => {}}
        trackData={{ uri: '' }}
        updateTrackData={() => {}}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', () => {
    const updateTrackSource = jest.fn(() => {})
    const updateTrackData = jest.fn(() => {})
    const wrapper = mount(
      <TrackSourceSelect
        trackSource="fromFile"
        updateTrackSource={updateTrackSource}
        trackData={{ uri: '' }}
        updateTrackData={updateTrackData}
      />,
    )
    let radioGroups = wrapper.find('RadioGroup')
    radioGroups.get(0).props.onChange({ target: { value: 'fromFile' } })
    expect(radioGroups.get(0).props.value).toBe('fromFile')
    expect(radioGroups.get(1).props.value).toBe('uri')

    radioGroups.get(0).props.onChange({ target: { value: 'fromConfig' } })
    wrapper.setProps({ trackSource: 'fromConfig', trackData: { config: {} } })
    radioGroups = wrapper.find('RadioGroup')
    expect(radioGroups.get(0).props.value).toBe('fromConfig')
    expect(updateTrackSource.mock.calls.length).toBe(2)
    expect(updateTrackData.mock.calls.length).toBe(2)
  })
})
