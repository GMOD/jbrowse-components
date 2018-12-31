import { Provider } from 'mobx-react'
import React from 'react'
import renderer from 'react-test-renderer'

import ConfigurationEditor from './ConfigurationEditor'
import { ConfigurationSchema } from '../../../configuration'

import AlignmentsTrackSchemaFactory from '../../AlignmentsTrack/configSchema'
import JBrowse from '../../../JBrowse'

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

  it('renders with defaults of the AlignmentsTrack schema', () => {
    const AlignmentsTrackSchema = AlignmentsTrackSchemaFactory(
      new JBrowse().configure().pluginManager,
    )
    const component = renderer.create(
      <ConfigurationEditor
        model={{ target: AlignmentsTrackSchema.create() }}
      />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
