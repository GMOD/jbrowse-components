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
    const wrapper = shallow(<TrackSourceSelect updateTrackData={() => {}} />)
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', () => {
    const updateTrackData = jest.fn(() => {})
    const wrapper = mount(
      shallow(<TrackSourceSelect updateTrackData={updateTrackData} />).get(0),
    )
    expect(wrapper).toMatchSnapshot()
    const instance = wrapper.instance()

    instance.handleChange({ target: { value: 'fromFile' } })
    wrapper.update()
    const textBox = wrapper.find('[label="fileLocation"]').instance()
    textBox.props.onChange({ target: { value: 'test.bam' } })
    expect(wrapper).toMatchSnapshot()

    instance.handleChange({ target: { value: 'fromConfig' } })
    wrapper.update()
    const jsonBox = wrapper.find('JsonEditor').instance()
    jsonBox.onValueChange('{}')
    wrapper.update()
    expect(wrapper).toMatchSnapshot()
    expect(updateTrackData.mock.calls.length).toBe(3)
  })
})
