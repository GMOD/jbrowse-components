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
        type: 'string',
        defaultValue: 'bar',
      },
    })

    const { container } = render(
      <ConfigurationEditor model={{ target: TestSchema.create() }} />,
    )
    expect(container.firstChild).toMatchSnapshot()
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
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with defaults of the PileupTrack schema', () => {
    console.warn = jest.fn()
    const pluginManager = new PluginManager([new Alignments(), new SVG()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
    const PileupDisplaySchema = linearBasicDisplayConfigSchemaFactory(
      pluginManager,
    )
    const { container } = render(
      <ConfigurationEditor model={{ target: PileupDisplaySchema.create() }} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
