import { Provider } from 'mobx-react'
import React from 'react'
import renderer from 'react-test-renderer'

import ConfigurationEditor from './ConfigurationEditor'

describe('ConfigurationEditor drawer widget', () => {
  it('renders with just the required model elements', () => {

    const component = renderer.create(
      <Provider rootModel={rootModel}>
        <ConfigurationEditor model={rootModel.drawerWidgets.get('testId')} />
      </Provider>,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
