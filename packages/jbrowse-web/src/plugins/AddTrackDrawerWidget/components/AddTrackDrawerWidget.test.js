import { createMount, createShallow } from '@material-ui/core/test-utils'
import { Provider } from 'mobx-react'
import React from 'react'
import { createTestEnv } from '../../../JBrowse'
import AddTrackDrawerWidget from './AddTrackDrawerWidget'

jest.mock('shortid', () => ({ generate: 'testid' }))

describe('<AddTrackDrawerWidget />', () => {
  let shallow
  let mount
  let rootModel

  beforeAll(async () => {
    shallow = createShallow()
    mount = createMount()
    ;({ rootModel } = await createTestEnv({ configId: 'testing' }))
    const view = rootModel.addView('LinearGenomeView')
    rootModel.addDrawerWidget('AddTrackDrawerWidget', 'addTrackDrawerWidget', {
      view: view.id,
    })
  })

  it('shallowly renders', () => {
    const wrapper = shallow(
      <AddTrackDrawerWidget
        model={rootModel.drawerWidgets.get('addTrackDrawerWidget')}
      />,
    )
    expect(wrapper).toMatchSnapshot()
  })

  it('mounts', () => {
    const preWrap = mount(
      <Provider rootModel={rootModel}>
        <AddTrackDrawerWidget
          model={rootModel.drawerWidgets.get('addTrackDrawerWidget')}
        />
      </Provider>,
    )
    const wrapper = preWrap.find('AddTrackDrawerWidget')
    expect(wrapper).toMatchSnapshot()
    const instance = wrapper.instance()
    instance.setState({ trackData: { uri: 'test.bam' } })
    instance.handleNext()
    instance.handleBack()
    instance.handleNext()
    wrapper.update()
    instance.setState({ trackName: 'test track' })
    instance.handleNext()
    wrapper.update()
    expect(wrapper).toMatchSnapshot()
  })
})
