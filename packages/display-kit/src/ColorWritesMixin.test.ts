import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { getSnapshot, onPatch, types } from '@jbrowse/mobx-state-tree'

import ColorWritesMixin from './ColorWritesMixin.ts'
import {
  COLOR_SCALES,
  colorChannelOptions,
  colorDomainSlot,
  colorFieldSlot,
  colorLegendOptions,
  colorNamesSlot,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorTitleSlot,
  encodingOptions,
} from './colorConfigSchema.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const TestColor = ConfigurationSchema(
  'TestWritesColor',
  {
    value: { type: 'maybeColor' },
    ...colorFieldSlot({ field: 'field', fieldType: 'featureField' }),
    scale: ConfigurationSchema(
      'TestWritesColorScale',
      {
        ...colorScaleTypeSlot({
          scales: COLOR_SCALES,
          scaleName: 'TestWritesColorScaleType',
        }),
        ...colorDomainSlot({}),
        ...colorRangeSlot({}),
        ...colorNamesSlot,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    legend: ConfigurationSchema(
      'TestWritesColorLegend',
      { ...colorTitleSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color'),
)

function displayOf(color: AnyConfigurationSchemaType) {
  return types.compose(
    types.model({
      configuration: ConfigurationSchema('TestWritesDisplay', {
        encoding: ConfigurationSchema(
          'TestWritesEncoding',
          { color },
          encodingOptions,
        ),
      }),
    }),
    ColorWritesMixin(),
  )
}

const Display = displayOf(TestColor)

function display(color?: unknown) {
  return Display.create(
    { configuration: color === undefined ? {} : { encoding: { color } } },
    { pluginManager },
  )
}

function colorOf(d: ReturnType<typeof display>) {
  return getSnapshot(d.configuration.encoding.color)
}

test('a new field keeps only the constant', () => {
  const d = display({ value: 'red', field: 'type', scale: { domain: ['gene'] } })
  d.colorByField('source')
  expect(colorOf(d)).toEqual({ value: 'red', field: 'source' })
})

test("the way back parks the field, and re-picking it keeps the key's names", () => {
  const d = display({
    field: 'type',
    scale: { domain: ['gene', 'mRNA'], names: ['Gene', 'Transcript'] },
    legend: { title: 'Feature type' },
  })
  d.colorByField('')
  expect(colorOf(d)).toEqual({})
  expect(d.parkedColor).toMatchObject({ field: 'type' })
  d.colorByField('type')
  expect(colorOf(d)).toEqual({
    field: 'type',
    scale: { domain: ['gene', 'mRNA'], names: ['Gene', 'Transcript'] },
    legend: { title: 'Feature type' },
  })
})

test('a solid color parks the field, and undefined clears the color', () => {
  const d = display({ field: 'type', scale: { domain: ['gene'] } })
  d.setColorValue('steelblue')
  expect(colorOf(d)).toEqual({ value: 'steelblue' })
  d.setColorValue(undefined)
  expect(colorOf(d)).toEqual({})
  d.colorByField('type')
  expect(colorOf(d)).toEqual({ field: 'type', scale: { domain: ['gene'] } })
})

// Every color tier keys on the object's arrays, so a write of the same
// object would re-bake for nothing.
test('a pick of what already paints writes nothing', () => {
  const d = display({ field: 'type', scale: { domain: ['gene'] } })
  const patches: unknown[] = []
  onPatch(d, patch => patches.push(patch))
  d.colorByField('type')
  d.colorByField('type')
  const solid = display({ value: 'red' })
  onPatch(solid, patch => patches.push(patch))
  solid.setColorValue('red')
  expect(patches).toEqual([])
})

test('an unwritten color channel takes its first field', () => {
  const d = display()
  d.colorByField('strand')
  expect(colorOf(d)).toEqual({ field: 'strand' })
})

const StrandDefaultDisplay = displayOf(
  ConfigurationSchema(
    'TestStrandDefaultColor',
    {},
    {
      baseConfiguration: TestColor,
      ...colorChannelOptions('encoding.color', undefined, {
        impliedField: 'strand',
      }),
    },
  ),
)

// LGVSyntenyColor maps `strand` while its snapshot names no field
test('an implied field reads as written and keeps its range on a re-pick', () => {
  const d = StrandDefaultDisplay.create(
    { configuration: { encoding: { color: { scale: { range: ['red', 'blue'] } } } } },
    { pluginManager },
  )
  const patches: unknown[] = []
  onPatch(d, patch => patches.push(patch))
  d.colorByField('strand')
  expect(patches).toEqual([])
  expect(d.writtenColor).toEqual({
    field: 'strand',
    scale: { range: ['red', 'blue'] },
  })

  d.colorByField('mapq')
  expect(d.writtenColor).toEqual({ field: 'mapq' })
  d.colorByField('strand')
  expect(d.writtenColor).toEqual({
    field: 'strand',
    scale: { range: ['red', 'blue'] },
  })
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
    { configuration: { encoding: { color: { value: 'red', field: 'type' } } } },
    { pluginManager },
  )
  kept.pickSolidColor()
  expect(getSnapshot(kept.configuration.encoding.color)).toEqual({
    value: 'red',
  })
  const none = WithPicker.create(
    { configuration: { encoding: { color: { field: 'type' } } } },
    { pluginManager },
  )
  none.pickSolidColor()
  expect(getSnapshot(none.configuration.encoding.color)).toEqual({
    field: 'type',
  })
  expect(opened).toEqual(['picker', 'picker'])
})
