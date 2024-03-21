import React from 'react'
import { render } from '@testing-library/react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import Alignments from '@jbrowse/plugin-alignments'
import SVG from '@jbrowse/plugin-svg'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import ConfigurationEditor from './ConfigurationEditor'

describe('ConfigurationEditor widget', () => {
  it('renders with just the required model elements', () => {
    const TestSchema = ConfigurationSchema('TestThing', {
      foo: {
        defaultValue: 'bar',
        type: 'string',
      },
    })

    const { container } = render(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    expect(container).toMatchSnapshot()
  })

  it('renders all the different types of built-in slots', () => {
    const TestSchema = ConfigurationSchema('TestThing', {
      booleanTest: {
        defaultValue: true,
        description: 'booleanTest',
        name: 'booleanTest',
        type: 'boolean',
      },
      colorTest: {
        defaultValue: '#396494',
        description: 'colorTest',
        name: 'colorTest',
        type: 'color',
      },
      fileLocationTest: {
        defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.file' },
        description: 'fileLocationTest',
        name: 'fileLocationTest',
        type: 'fileLocation',
      },
      integerTest: {
        defaultValue: 42,
        description: 'integerTest',
        name: 'integerTest',
        type: 'integer',
      },
      numberTest: {
        defaultValue: 88.5,
        description: 'numberTest',
        name: 'numberTest',
        type: 'number',
      },
      stringArrayMapTest: {
        defaultValue: { key1: ['string1', 'string2'] },
        description: 'stringArrayMapTest',
        name: 'stringArrayMapTest',
        type: 'stringArrayMap',
      },
      stringArrayTest: {
        defaultValue: ['string1', 'string2'],
        description: 'stringArrayTest',
        name: 'stringArrayTest',
        type: 'stringArray',
      },
      stringTest: {
        defaultValue: 'string1',
        description: 'stringTest',
        name: 'stringTest',
        type: 'string',
      },
    })

    const { container } = render(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    expect(container).toMatchSnapshot()
  })

  it('renders with defaults of the PileupTrack schema', () => {
    const pluginManager = new PluginManager([new Alignments(), new SVG()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
    const PileupDisplaySchema =
      linearBasicDisplayConfigSchemaFactory(pluginManager)
    const { container } = render(
      <ConfigurationEditor model={{ target: PileupDisplaySchema.create() }} />,
    )
    expect(container).toMatchSnapshot()
  })
})
