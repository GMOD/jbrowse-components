import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import FeaturesPlugin from '@jbrowse/plugin-features'

import VariantsPlugin from '../index.ts'
import configSchemaFactory from './configSchema.ts'

function variantEntries(displays: Record<string, unknown>[]) {
  const pluginManager = new PluginManager([
    new FeaturesPlugin(),
    new VariantsPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const out = preprocessTrackConfigSnapshot(pluginManager, {
    type: 'VariantTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'VcfAdapter', uri: 'volvox.filtered.vcf' },
    displays,
  })
  return out.displays as Record<string, unknown>[]
}

test('a config choosing the v4 matrix opens this display in columns', () => {
  expect(
    variantEntries([{ type: 'LinearVariantMatrixDisplay', height: 400 }]),
  ).toEqual([
    {
      type: 'LinearVariantDisplay',
      displayId: 't-LinearVariantDisplay',
      height: 400,
      variantLayout: 'columns',
    },
  ])
})

// A session saved after switching to the matrix holds every display's entry,
// in registration order, with the reader's settings on the matrix's alone.
test('the matrix entry wins over a bare stub, under the stub id', () => {
  expect(
    variantEntries([
      { type: 'LinearVariantDisplay', displayId: 't-LinearVariantDisplay' },
      {
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 't-LinearMultiSampleVariantDisplay',
      },
      {
        type: 'LinearVariantMatrixDisplay',
        displayId: 't-LinearVariantMatrixDisplay',
        height: 400,
      },
    ]),
  ).toEqual([
    {
      type: 'LinearVariantDisplay',
      displayId: 't-LinearVariantDisplay',
      height: 400,
      variantLayout: 'columns',
    },
  ])
})

test.each([
  [
    { type: 'LinearVariantDisplay', height: 300 },
    { type: 'LinearVariantMatrixDisplay', height: 400 },
  ],
  [
    { type: 'LinearVariantMatrixDisplay', height: 400 },
    { type: 'LinearVariantDisplay', height: 300 },
  ],
])('a configured entry for this display keeps it genomic', (...displays) => {
  const [entry] = variantEntries(displays)
  expect(entry!.height).toBe(300)
  expect(entry!.variantLayout).toBeUndefined()
})

test('the v4 multi-sample name loads as this display', () => {
  expect(
    variantEntries([
      {
        type: 'MultiLinearVariantDisplay',
        displayId: 't-MultiLinearVariantDisplay',
        height: 350,
      },
    ]),
  ).toEqual([
    {
      type: 'LinearVariantDisplay',
      displayId: 't-LinearVariantDisplay',
      height: 350,
    },
  ])
})

test("the betas' multi-sample name loads as this display, settings whole", () => {
  expect(
    variantEntries([
      {
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 't-LinearMultiSampleVariantDisplay',
        height: 350,
        rowColor: 'population',
        records: { show: false },
      },
    ]),
  ).toEqual([
    {
      type: 'LinearVariantDisplay',
      displayId: 't-LinearVariantDisplay',
      height: 350,
      rowColor: 'population',
      records: { show: false },
    },
  ])
})

// v4's LinearVariantDisplay was a feature display: its record settings sat in
// a `renderer` block, which the records band holds now.
test('a v4 LinearVariantDisplay config lifts its record settings to records', () => {
  const configSchema = configSchemaFactory()
  const conf = configSchema.create({
    type: 'LinearVariantDisplay',
    displayId: 'v4',
    maxFeatureScreenDensity: 0.5,
    mouseover: 'jexl:get(feature,"INFO").CLNSIG',
    renderer: {
      type: 'SvgFeatureRenderer',
      displayMode: 'compact',
      height: 7,
      color1: 'green',
      showLabels: false,
      maxHeight: 900,
    },
  })
  expect(readConfObject(conf, ['records', 'displayMode'])).toBe('compact')
  expect(readConfObject(conf, ['records', 'mark', 'height'])).toBe(7)
  expect(readConfObject(conf, ['records', 'maxFeatureScreenDensity'])).toBe(0.5)
  expect(readConfObject(conf, ['records', 'labels', 'name', 'show'])).toBe(
    false,
  )
  expect(getSnapshot(conf)).toMatchObject({
    records: { tooltip: { field: 'jexl:get(feature,"INFO").CLNSIG' } },
    encoding: { color: { value: 'green' } },
  })
  // neither the second grow ceiling nor the renderer's height sets the band
  expect(getSnapshot(conf).records).not.toHaveProperty('height')
})

test("v4's top-level feature spellings land under records too", () => {
  const conf = configSchemaFactory().create({
    type: 'LinearVariantDisplay',
    displayId: 'v4',
    featureHeight: 5,
    showDescriptions: false,
    maxHeight: 1200,
  })
  expect(readConfObject(conf, ['records', 'mark', 'height'])).toBe(5)
  expect(
    readConfObject(conf, ['records', 'labels', 'description', 'show']),
  ).toBe(false)
})
