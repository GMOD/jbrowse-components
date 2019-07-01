import React from 'react'
import { render } from 'react-testing-library'

import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { createTestEnv } from '@gmod/jbrowse-web/src/JBrowse'
import AlignmentsTrackSchemaFactory from '@gmod/jbrowse-plugin-alignments/src/AlignmentsTrack/configSchema'
import ConfigurationEditor from './ConfigurationEditor'

describe('ConfigurationEditor drawer widget', () => {
  it('renders with just the required model elements', () => {
    const TestSchema = ConfigurationSchema('TestThing', {
      foo: {
        type: 'string',
        defaultValue: 'bar',
      },
    })

    const { container } = render(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    expect(container).toMatchSnapshot()
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

    const { container } = render(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    expect(container).toMatchSnapshot()
  })

  it('renders with defaults of the AlignmentsTrack schema', async () => {
    const { pluginManager } = await createTestEnv()
    const AlignmentsTrackSchema = AlignmentsTrackSchemaFactory(pluginManager)
    const { container } = render(
      <ConfigurationEditor
        model={{ target: AlignmentsTrackSchema.create() }}
      />,
    )
    expect(container).toMatchSnapshot()
  })
})
