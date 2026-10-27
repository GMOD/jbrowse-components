import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, within } from '@testing-library/react'

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
  expect(queryByLabelText('Reset to default')).toBeNull()

  fireEvent.change(getByLabelText('myName'), { target: { value: 'edited' } })
  expect(readConfObject(target, 'myName')).toBe('edited')

  // now modified, the reset control shows; clicking it restores the default
  fireEvent.click(getByLabelText('Reset to default'))
  expect(readConfObject(target, 'myName')).toBe('original')
  expect(queryByLabelText('Reset to default')).toBeNull()
})

// The URL field writes `{ uri: '' }` when cleared, which a maybeFileLocation
// slot reads as unset, so clearing it is the same as never having filled it.
test('a maybeFileLocation slot starts unset and a cleared URL returns it there', () => {
  const TestSchema = ConfigurationSchema('TestThing', {
    sidecar: { type: 'maybeFileLocation' },
  })
  const target = TestSchema.create(undefined, { pluginManager })

  const { getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target }} />
    </ThemeProvider>,
  )

  const input = getByTestId('urlInput') as HTMLInputElement
  expect(input.value).toBe('')

  fireEvent.change(input, { target: { value: 'https://x.org/samples.tsv' } })
  expect(readConfObject(target, 'sidecar')).toEqual({
    uri: 'https://x.org/samples.tsv',
    locationType: 'UriLocation',
  })

  fireEvent.change(input, { target: { value: '' } })
  expect(readConfObject(target, 'sidecar')).toBeUndefined()
})

const DisplaySchema = ConfigurationSchema(
  'TestDisplay',
  {
    height: { type: 'number', defaultValue: 100 },
    color: { type: 'color', defaultValue: 'blue', plot: true },
  },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)
const OtherDisplaySchema = ConfigurationSchema(
  'OtherDisplay',
  { rowHeight: { type: 'number', defaultValue: 10 } },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)
const TrackSchema = ConfigurationSchema(
  'TestTrack',
  {
    name: { type: 'string', defaultValue: '' },
    hint: { type: 'string', defaultValue: '', advanced: true },
    adapter: ConfigurationSchema('TestAdapter', {
      location: { type: 'fileLocation', defaultValue: { uri: '/x.bam' } },
      index: ConfigurationSchema('TestIndex', {
        indexLocation: {
          type: 'fileLocation',
          defaultValue: { uri: '/x.bam.bai' },
        },
      }),
    }),
    formatDetails: ConfigurationSchema('TestFormat', {
      feature: { type: 'string', defaultValue: '' },
    }),
    displays: types.array(types.union(DisplaySchema, OtherDisplaySchema)),
  },
  { explicitIdentifier: 'trackId', closed: true },
)

function trackConfig() {
  return TrackSchema.create(
    {
      trackId: 't1',
      name: 'Reads',
      displays: [
        { type: 'TestDisplay', displayId: 't1-a' },
        { type: 'OtherDisplay', displayId: 't1-b' },
      ],
    },
    { pluginManager },
  )
}

function renderEditor(
  target: ReturnType<typeof trackConfig>,
  displayId?: string,
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target, expandedDisplayId: displayId }} />
    </ThemeProvider>,
  )
}

test('the form holds the track, its data and the displayed display, and no more', () => {
  const { queryByLabelText, getByText } = renderEditor(trackConfig(), 't1-a')
  expect(queryByLabelText('name')).toBeTruthy()
  expect(getByText('Data')).toBeTruthy()
  expect(getByText('index')).toBeTruthy()
  expect(getByText('Display: TestDisplay')).toBeTruthy()
  expect(queryByLabelText('height')).toBeTruthy()
  // advanced, nested outside the adapter, a plot setting, another display
  expect(queryByLabelText('hint')).toBeNull()
  expect(queryByLabelText('feature')).toBeNull()
  expect(queryByLabelText('color')).toBeNull()
  expect(queryByLabelText('rowHeight')).toBeNull()
})

test('opened from no view, the form shows no display', () => {
  const { queryByText } = renderEditor(trackConfig())
  expect(queryByText(/^Display:/)).toBeNull()
})

function openJson(target: ReturnType<typeof trackConfig>) {
  const result = renderEditor(target, 't1-a')
  fireEvent.click(result.getByText('Edit as JSON...'))
  const field = result.getByTestId('settingsJson') as HTMLTextAreaElement
  const apply = within(result.getByRole('dialog')).getByText('Apply')
  return { ...result, field, apply }
}

test('the JSON editor applies a setting the form does not show', () => {
  const target = trackConfig()
  const { field, apply } = openJson(target)
  const snapshot = JSON.parse(field.value)
  fireEvent.change(field, {
    target: { value: JSON.stringify({ ...snapshot, hint: 'tip' }) },
  })
  fireEvent.click(apply)
  expect(readConfObject(target, 'hint')).toBe('tip')
})

test('the JSON editor refuses an undeclared key and a new trackId', () => {
  const target = trackConfig()
  const { field, apply, getByText } = openJson(target)
  const snapshot = JSON.parse(field.value)
  fireEvent.change(field, {
    target: { value: JSON.stringify({ ...snapshot, hnit: 'tip' }) },
  })
  expect(getByText(/hnit/, { selector: 'p' })).toBeTruthy()
  expect(apply.closest('button')!.disabled).toBe(true)
  fireEvent.change(field, {
    target: { value: JSON.stringify({ ...snapshot, trackId: 'other' }) },
  })
  expect(getByText(/trackId must stay "t1"/, { selector: 'p' })).toBeTruthy()
  expect(apply.closest('button')!.disabled).toBe(true)
})

test("with a base, a slot's reset returns to the base's value, not the default", () => {
  const base = trackConfig()
  const target = trackConfig()
  const { getByLabelText, queryAllByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor
        model={{ target, base, expandedDisplayId: 't1-a' }}
      />
    </ThemeProvider>,
  )
  // "Reads" differs from the schema default but is what the base holds
  const reset = "Reset to the track's config"
  expect(queryAllByLabelText(reset)).toHaveLength(0)
  fireEvent.change(getByLabelText('name'), { target: { value: 'Edited' } })
  fireEvent.change(getByLabelText('height'), { target: { value: '300' } })
  expect(queryAllByLabelText(reset)).toHaveLength(2)
  fireEvent.click(queryAllByLabelText(reset)[0]!)
  fireEvent.click(getByLabelText(reset))
  expect(readConfObject(target, 'name')).toBe('Reads')
  expect(readConfObject(target.displays[0]!, 'height')).toBe(100)
  expect(queryAllByLabelText(reset)).toHaveLength(0)
})

// fills in an `OtherDisplay` entry the snapshot leaves out, as a track type
// fills in each display its adapter feeds
const FillingTrackSchema = ConfigurationSchema(
  'FillingTrack',
  {
    displays: types.array(types.union(DisplaySchema, OtherDisplaySchema)),
  },
  {
    explicitIdentifier: 'trackId',
    closed: true,
    preProcessSnapshot: snap => {
      const displays = (snap.displays ?? []) as { type: string }[]
      return displays.some(d => d.type === 'OtherDisplay')
        ? snap
        : {
            ...snap,
            displays: [
              ...displays,
              {
                type: 'OtherDisplay',
                displayId: `${snap.trackId}-OtherDisplay`,
              },
            ],
          }
    },
  },
)

test('the JSON leaves out a display the track fills in, and keeps one it would not', () => {
  const target = FillingTrackSchema.create(
    {
      trackId: 't2',
      displays: [{ type: 'TestDisplay', displayId: 't2-TestDisplay' }],
    },
    { pluginManager },
  )
  const { getByText, getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ConfigurationEditor model={{ target }} />
    </ThemeProvider>,
  )
  fireEvent.click(getByText('Edit as JSON...'))
  const printed = JSON.parse(
    (getByTestId('settingsJson') as HTMLTextAreaElement).value,
  )
  expect(printed.displays).toEqual([
    { type: 'TestDisplay', displayId: 't2-TestDisplay' },
  ])
})
