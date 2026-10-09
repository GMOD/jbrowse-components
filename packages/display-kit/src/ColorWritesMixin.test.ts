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

function display(color?: unknown) {
  return Display.create(
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
  expect(colorOf(d)).toMatchObject({ field: 'type', scale: 'none' })
  d.colorByField('type')
  expect(colorOf(d)).toEqual({
    field: 'type',
    domain: ['gene', 'mRNA'],
    labels: ['Gene', 'Transcript'],
    title: 'Feature type',
  })
})

test('a solid color parks the field under none, and undefined clears it', () => {
  const d = display({ field: 'type' })
  d.setColorValue('steelblue')
  expect(colorOf(d)).toEqual({
    value: 'steelblue',
    field: 'type',
    scale: 'none',
  })
  d.setColorValue(undefined)
  expect(colorOf(d)).toEqual({ field: 'type', scale: 'none' })
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
