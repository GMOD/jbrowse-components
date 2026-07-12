import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
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

test('typing into a slot field writes through to the target config node', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    myName: {
      name: 'myName',
      description: 'a string slot',
      type: 'string',
      defaultValue: 'original',
    },
  })
  const target = TestSchema.create(undefined, { pluginManager })

  const { getByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target }} />
    </ThemeProvider>,
  )

  fireEvent.change(getByLabelText('myName'), {
    target: { value: 'edited' },
  })

  // the rendered SlotEditor's makeSlotFacade().set() ran node.setSlot, so the
  // live target reflects the edit — which is what the widget's debounced autorun
  // then snapshots and persists (see ConfigurationEditorWidget model.ts)
  expect(readConfObject(target, 'myName')).toBe('edited')
})

test('a maybeBoolean slot starts unchecked (undefined) and pins true on click', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    maybeBoolTest: {
      name: 'maybeBoolTest',
      description: 'maybeBoolTest',
      type: 'maybeBoolean',
      defaultValue: undefined,
    },
  })
  const target = TestSchema.create(undefined, { pluginManager })

  // React warns via console.error when an input flips uncontrolled ->
  // controlled, which is what checked={undefined} -> checked={true} did before
  // the checkbox coerced with !!slot.value
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  const { getByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target }} />
    </ThemeProvider>,
  )

  const checkbox = getByLabelText('maybeBoolTest') as HTMLInputElement
  expect(checkbox.checked).toBe(false)

  // clicking transitions the underlying value undefined -> true
  fireEvent.click(checkbox)
  expect(readConfObject(target, 'maybeBoolTest')).toBe(true)

  // no React/MUI uncontrolled->controlled warning fired during that transition
  const warnings = errorSpy.mock.calls.map(args => String(args[0]))
  expect(warnings.some(msg => msg.includes('uncontrolled'))).toBe(false)
  errorSpy.mockRestore()
})

test('reset-to-default appears only when a slot differs, and reverts it', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    myName: {
      name: 'myName',
      description: 'a string slot',
      type: 'string',
      defaultValue: 'original',
    },
  })
  const target = TestSchema.create(undefined, { pluginManager })

  const { getByLabelText, queryByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target }} />
    </ThemeProvider>,
  )

  // at the default value there is nothing to reset
  expect(queryByLabelText('reset to default')).toBeNull()

  fireEvent.change(getByLabelText('myName'), { target: { value: 'edited' } })
  expect(readConfObject(target, 'myName')).toBe('edited')

  // now modified, the reset control shows; clicking it restores the default
  fireEvent.click(getByLabelText('reset to default'))
  expect(readConfObject(target, 'myName')).toBe('original')
  expect(queryByLabelText('reset to default')).toBeNull()
})

test('reset un-pins a promotable maybeBoolean back to its inherit default', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    maybeBoolTest: {
      name: 'maybeBoolTest',
      description: 'maybeBoolTest',
      type: 'maybeBoolean',
      defaultValue: undefined,
    },
  })
  const target = TestSchema.create(undefined, { pluginManager })

  const { getByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target }} />
    </ThemeProvider>,
  )

  // pinning true diverges from the undefined (inherit) default
  fireEvent.click(getByLabelText('maybeBoolTest'))
  expect(readConfObject(target, 'maybeBoolTest')).toBe(true)

  // reset returns it to the inherit sentinel (undefined)
  fireEvent.click(getByLabelText('reset to default'))
  expect(readConfObject(target, 'maybeBoolTest')).toBeUndefined()
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
