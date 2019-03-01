import React from 'react'
import renderer from 'react-test-renderer'

import ConfigurationEditor from './ConfigurationEditor'
import { ConfigurationSchema } from '../../../configuration'

import AlignmentsTrackSchemaFactory from '../../AlignmentsTrack/configSchema'
import { createTestEnv } from '../../../JBrowse'

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

  it('renders all the different types of built-in slots', () => {
    const TestSchema = ConfigurationSchema('TestThing', {
      stringTest: {
        name: 'stringTest',
        description: 'stringTest',
        type: 'string',
        defaultValue: 'string1',
      },
      fileLocationTest: {
        name: 'fileLocationTest',
        description: 'fileLocationTest',
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.file' },
      },
      stringArrayTest: {
        name: 'stringArrayTest',
        description: 'stringArrayTest',
        type: 'stringArray',
        defaultValue: ['string1', 'string2'],
      },
      stringArrayMapTest: {
        name: 'stringArrayMapTest',
        description: 'stringArrayMapTest',
        type: 'stringArrayMap',
        defaultValue: { key1: ['string1', 'string2'] },
      },
      numberTest: {
        name: 'numberTest',
        description: 'numberTest',
        type: 'number',
        defaultValue: 88.5,
      },
      integerTest: {
        name: 'integerTest',
        description: 'integerTest',
        type: 'integer',
        defaultValue: 42,
      },
      colorTest: {
        name: 'colorTest',
        description: 'colorTest',
        type: 'color',
        defaultValue: '#396494',
      },
      booleanTest: {
        name: 'booleanTest',
        description: 'booleanTest',
        type: 'boolean',
        defaultValue: true,
      },
    })

    const component = renderer.create(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders with defaults of the AlignmentsTrack schema', async () => {
    const { pluginManager } = await createTestEnv()
    const AlignmentsTrackSchema = AlignmentsTrackSchemaFactory(pluginManager)
    const component = renderer.create(
      <ConfigurationEditor
        model={{ target: AlignmentsTrackSchema.create() }}
      />,
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
