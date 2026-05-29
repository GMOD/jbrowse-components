import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import ConfigurationEditor from './ConfigurationEditor.tsx'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

test('renders with just the required model elements', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    foo: {
      type: 'string',
      defaultValue: 'bar',
    },
  })

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{ target: TestSchema.create(undefined, { pluginManager }) }}
      />
      ,
    </ThemeProvider>,
  )
  expect(container).toMatchSnapshot()
})

test('renders all the different types of built-in slots', () => {
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
      defaultValue: { uri: '/path/to/my.file', locationType: 'UriLocation' },
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
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{ target: TestSchema.create(undefined, { pluginManager }) }}
      />
      ,
    </ThemeProvider>,
  )
  expect(container).toMatchSnapshot()
})

test('filters slots by name', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    fooColor: {
      name: 'fooColor',
      description: 'a color slot',
      type: 'color',
      defaultValue: '#396494',
    },
    barName: {
      name: 'barName',
      description: 'a string slot',
      type: 'string',
      defaultValue: 'hello',
    },
  })

  const { getByLabelText, queryByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{ target: TestSchema.create(undefined, { pluginManager }) }}
      />
    </ThemeProvider>,
  )

  expect(queryByLabelText('fooColor')).toBeTruthy()
  expect(queryByLabelText('barName')).toBeTruthy()

  fireEvent.change(getByLabelText('Filter options'), {
    target: { value: 'color' },
  })

  expect(queryByLabelText('fooColor')).toBeTruthy()
  expect(queryByLabelText('barName')).toBeNull()
})

// Removed: PileupTrack schema test — Alignments plugin no longer registers
// renderers (moved to GPU pipeline), so baseLinearDisplayConfigSchema
// with only Alignments produces an empty renderer union.
