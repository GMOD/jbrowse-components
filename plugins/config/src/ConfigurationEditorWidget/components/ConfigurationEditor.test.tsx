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

test('filters slots by description (not just name)', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    fooColor: {
      description: 'a color slot',
      type: 'color',
      defaultValue: '#396494',
    },
    barName: {
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

  // 'string' appears only in barName's description, not in either slot name
  fireEvent.change(getByLabelText('Filter options'), {
    target: { value: 'string' },
  })
  expect(queryByLabelText('barName')).toBeTruthy()
  expect(queryByLabelText('fooColor')).toBeNull()
})

test('hides advanced slots behind a toggle, and reveals them', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    basicName: {
      name: 'basicName',
      description: 'a basic slot',
      type: 'string',
      defaultValue: 'hello',
    },
    fancyName: {
      name: 'fancyName',
      description: 'an advanced slot',
      type: 'string',
      defaultValue: 'world',
      advanced: true,
    },
  })

  const { getByText, queryByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{ target: TestSchema.create(undefined, { pluginManager }) }}
      />
    </ThemeProvider>,
  )

  // advanced slot hidden initially, basic slot visible
  expect(queryByLabelText('basicName')).toBeTruthy()
  expect(queryByLabelText('fancyName')).toBeNull()

  fireEvent.click(getByText(/Show advanced settings/))
  expect(queryByLabelText('fancyName')).toBeTruthy()
})

test('an active filter reveals matching advanced slots inline', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    basicName: {
      name: 'basicName',
      description: 'a basic slot',
      type: 'string',
      defaultValue: 'hello',
    },
    fancyName: {
      name: 'fancyName',
      description: 'an advanced slot',
      type: 'string',
      defaultValue: 'world',
      advanced: true,
    },
  })

  const { getByLabelText, queryByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{ target: TestSchema.create(undefined, { pluginManager }) }}
      />
    </ThemeProvider>,
  )

  fireEvent.change(getByLabelText('Filter options'), {
    target: { value: 'fancy' },
  })
  expect(queryByLabelText('fancyName')).toBeTruthy()
  expect(queryByLabelText('basicName')).toBeNull()
})

test('filtering force-expands an otherwise-collapsed display sub-schema', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    subDisplay: ConfigurationSchema('SubDisplay', {
      displayId: {
        type: 'string',
        defaultValue: 'other-display',
      },
      hiddenSlot: {
        name: 'hiddenSlot',
        description: 'a slot buried inside an inactive display',
        type: 'string',
        defaultValue: 'zzz',
      },
    }),
  })

  const { getByText, getByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{
          // active display differs from subDisplay's id, so its accordion
          // starts collapsed
          expandedDisplayId: 'active-display',
          target: TestSchema.create(undefined, { pluginManager }),
        }}
      />
    </ThemeProvider>,
  )

  const summary = () => getByText('subDisplay').closest('button')

  // collapsed by default since its displayId doesn't match expandedDisplayId
  expect(summary()?.getAttribute('aria-expanded')).toBe('false')

  // a filter matching a slot inside it must reveal the match, not leave it
  // collapsed
  fireEvent.change(getByLabelText('Filter options'), {
    target: { value: 'hidden' },
  })
  expect(summary()?.getAttribute('aria-expanded')).toBe('true')
})

// Removed: PileupTrack schema test — Alignments plugin no longer registers
// renderers (moved to GPU pipeline), so baseLinearDisplayConfigSchema
// with only Alignments produces an empty renderer union.
