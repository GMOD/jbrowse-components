import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { getSnapshot, onPatch, types } from '@jbrowse/mobx-state-tree'

import ColorWritesMixin from './ColorWritesMixin.ts'
import {
  COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorLabelsSlot,
  colorRangeSlot,
  colorTitleSlot,
} from './colorConfigSchema.ts'

import type {
  IAnyModelType,
  Instance,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const TestColor = ConfigurationSchema(
  'TestWritesColor',
  {
    value: { type: 'maybeColor' },
    ...colorChannelSlots({
      scales: COLOR_SCALES,
      scaleName: 'TestWritesColorScale',
      field: 'field',
      fieldType: 'featureField',
    }),
    ...colorDomainSlot({}),
    ...colorRangeSlot({}),
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('color'),
)

const Display = types.compose(
  types.model({
    configuration: ConfigurationSchema('TestWritesDisplay', {
      color: TestColor,
    }),
  }),
  ColorWritesMixin(),
)

// ParkedColorMixin installs its reaction on attach, so a test model hangs
// under a root as a display or view does
function attached<T extends IAnyModelType>(
  Type: T,
  snapshot: SnapshotIn<T>,
  env?: object,
): Instance<T> {
  const root = types
    .model({ child: types.maybe(Type) })
    .actions(self => ({
      attach(child: SnapshotIn<T>) {
        self.child = child as never
      },
    }))
    .create({} as never, env)
  root.attach(snapshot)
  return root.child as Instance<T>
}

function display(color?: unknown) {
  return attached(
    Display,
    { configuration: color === undefined ? {} : { color } },
    { pluginManager },
  )
}

function colorOf(d: ReturnType<typeof display>) {
  return getSnapshot(d.configuration.color)
}

test('a new field keeps only the constant', () => {
  const d = display({ value: 'red', field: 'type', domain: ['gene'] })
  d.colorByField('source')
  expect(colorOf(d)).toEqual({ value: 'red', field: 'source' })
})

test("the way back parks the field, and re-picking it keeps the key's names", () => {
  const d = display({
    field: 'type',
    domain: ['gene', 'mRNA'],
    labels: ['Gene', 'Transcript'],
    title: 'Feature type',
  })
  d.colorByField('')
  expect(colorOf(d)).toEqual({})
  expect(d.parkedColor).toMatchObject({ field: 'type' })
  d.colorByField('type')
  expect(colorOf(d)).toEqual({
    field: 'type',
    domain: ['gene', 'mRNA'],
    labels: ['Gene', 'Transcript'],
    title: 'Feature type',
  })
})

test('a solid color parks the field, and undefined clears the color', () => {
  const d = display({ field: 'type', domain: ['gene'] })
  d.setColorValue('steelblue')
  expect(colorOf(d)).toEqual({ value: 'steelblue' })
  d.setColorValue(undefined)
  expect(colorOf(d)).toEqual({})
  d.colorByField('type')
  expect(colorOf(d)).toEqual({ field: 'type', domain: ['gene'] })
})

// Every color tier keys on the object's arrays, so a write of the same
// object would re-bake for nothing.
test('a pick of what already paints writes nothing', () => {
  const d = display({ field: 'type', domain: ['gene'] })
  const patches: unknown[] = []
  onPatch(d, patch => patches.push(patch))
  d.colorByField('type')
  d.colorByField('type')
  expect(patches).toEqual([])
})

test('an unwritten color object takes its first field', () => {
  const d = display()
  d.colorByField('strand')
  expect(colorOf(d)).toEqual({ field: 'strand' })
})

const StrandDefaultDisplay = types.compose(
  types.model({
    configuration: ConfigurationSchema('TestStrandDefaultDisplay', {
      color: ConfigurationSchema(
        'TestStrandDefaultColor',
        {},
        {
          baseConfiguration: TestColor,
          ...colorChannelOptions('color', undefined, {
            impliedField: 'strand',
          }),
        },
      ),
    }),
  }),
  ColorWritesMixin(),
)

// LGVSyntenyColor maps `strand` while its snapshot names no field
test('an implied field reads as written and keeps its range on a re-pick', () => {
  const d = attached(
    StrandDefaultDisplay,
    { configuration: { color: { range: ['red', 'blue'] } } },
    { pluginManager },
  )
  const patches: unknown[] = []
  onPatch(d, patch => patches.push(patch))
  d.colorByField('strand')
  expect(patches).toEqual([])
  expect(d.writtenColor).toEqual({ field: 'strand', range: ['red', 'blue'] })

  d.colorByField('mapq')
  expect(d.writtenColor).toEqual({ field: 'mapq' })
  d.colorByField('strand')
  expect(d.writtenColor).toEqual({ field: 'strand', range: ['red', 'blue'] })
})

test('Default clears the constant and the field together', () => {
  const kept = display({ value: 'red', field: 'type' })
  kept.pickDefaultColor()
  expect(colorOf(kept)).toEqual({})
  expect(kept.parkedColor).toEqual({ field: 'type' })
})

test('Solid color paints the constant kept beside a painting field, and opens the picker', () => {
  const opened: string[] = []
  const WithPicker = Display.actions(() => ({
    openSolidColorDialog() {
      opened.push('picker')
    },
  }))
  const kept = WithPicker.create(
    { configuration: { color: { value: 'red', field: 'type' } } },
    { pluginManager },
  )
  kept.pickSolidColor()
  expect(getSnapshot(kept.configuration.color)).toEqual({ value: 'red' })
  const none = WithPicker.create(
    { configuration: { color: { field: 'type' } } },
    { pluginManager },
  )
  none.pickSolidColor()
  expect(getSnapshot(none.configuration.color)).toEqual({ field: 'type' })
  expect(opened).toEqual(['picker', 'picker'])
})
