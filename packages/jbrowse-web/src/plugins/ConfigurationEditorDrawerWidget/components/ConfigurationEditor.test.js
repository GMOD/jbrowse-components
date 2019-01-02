import { Provider } from 'mobx-react'
import React from 'react'
import renderer from 'react-test-renderer'

import ConfigurationEditor from './ConfigurationEditor'
import { ConfigurationSchema } from '../../../configuration'

describe('ConfigurationEditor drawer widget', () => {
  it('renders with just the required model elements', () => {
    const TestSchema = ConfigurationSchema('TestThing', {
      foo: {
        type: 'string',
        defaultValue: 'bar',
      },
    })

    const component = renderer.create(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
