import PluginManager from '@jbrowse/core/PluginManager'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import VariantsPlugin from '../index.ts'

function multiSampleEntries(displays: Record<string, unknown>[]) {
  const pluginManager = new PluginManager([new VariantsPlugin()])
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
  return (out.displays as Record<string, unknown>[]).filter(
    d => d.type === 'LinearMultiSampleVariantDisplay',
  )
}

test.each([
  'LinearMultiSampleVariantMatrixDisplay',
  'LinearVariantMatrixDisplay',
])('a config choosing the %s opens this display in columns', type => {
  expect(multiSampleEntries([{ type, height: 400 }])).toEqual([
    {
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 't-LinearMultiSampleVariantDisplay',
      height: 400,
      variantLayout: 'columns',
    },
  ])
})

// A session saved after switching to the matrix holds every display's entry,
// in registration order, with the reader's settings on the matrix's alone.
test('the matrix entry wins over a bare stub, under the stub id', () => {
  expect(
    multiSampleEntries([
      { type: 'LinearVariantDisplay', displayId: 't-LinearVariantDisplay' },
      {
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 't-LinearMultiSampleVariantDisplay',
      },
      {
        type: 'LinearMultiSampleVariantMatrixDisplay',
        displayId: 't-LinearMultiSampleVariantMatrixDisplay',
        height: 400,
      },
    ]),
  ).toEqual([
    {
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 't-LinearMultiSampleVariantDisplay',
      height: 400,
      variantLayout: 'columns',
    },
  ])
})

test.each([
  [
    { type: 'LinearMultiSampleVariantDisplay', height: 300 },
    { type: 'LinearMultiSampleVariantMatrixDisplay', height: 400 },
  ],
  [
    { type: 'LinearMultiSampleVariantMatrixDisplay', height: 400 },
    { type: 'LinearMultiSampleVariantDisplay', height: 300 },
  ],
])('a configured entry for this display keeps it genomic', (...displays) => {
  const [entry] = multiSampleEntries(displays)
  expect(entry!.height).toBe(300)
  expect(entry!.variantLayout).toBeUndefined()
})

test('the old multi-sample name loads as this display', () => {
  expect(
    multiSampleEntries([
      {
        type: 'MultiLinearVariantDisplay',
        displayId: 't-MultiLinearVariantDisplay',
        height: 350,
      },
    ]),
  ).toEqual([
    {
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 't-LinearMultiSampleVariantDisplay',
      height: 350,
    },
  ])
})
