import { createMount, createShallow } from '@material-ui/core/test-utils'
import { Provider } from 'mobx-react'
import React from 'react'
import JBrowse from '../../../JBrowse'
import AddTrackDrawerWidget from './AddTrackDrawerWidget'

jest.mock('shortid', () => ({ generate: 'testid' }))

describe('<AddTrackDrawerWidget />', () => {
  let shallow
  let mount
  let jbrowse
  let rootModel

  beforeAll(() => {
    shallow = createShallow()
    mount = createMount()
    jbrowse = new JBrowse().configure({ configId: 'testing' })
    rootModel = jbrowse.model
    rootModel.addDrawerWidget('AddTrackDrawerWidget', 'addTrackDrawerWidget')
  })

  xit('shallowly renders', () => {
    const wrapper = shallow(<AddTrackDrawerWidget rootModel={rootModel} />)
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', () => {
    // shortid.generate = jest.fn(() => 'testId')
    const preWrap = mount(
      <Provider rootModel={rootModel}>
        <AddTrackDrawerWidget />
      </Provider>,
    )
    const wrapper = preWrap.find('AddTrackDrawerWidget')
    expect(wrapper).toMatchSnapshot()
    const instance = wrapper.instance()
    instance.setState({ trackData: { uri: 'test.bam' } })
    instance.handleNext()
    wrapper.update()
    instance.setState({ trackName: 'test track' })
    instance.handleNext()
    wrapper.update()
    expect(wrapper).toMatchSnapshot()
  })
})
