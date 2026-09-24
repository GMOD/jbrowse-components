import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import VariantsPlugin from '../index.ts'
import { foldRetiredMatrixDisplay } from './retiredMatrixDisplay.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const track = (displays: Record<string, unknown>[]) => ({
  type: 'VariantTrack',
  trackId: 't',
  name: 't',
  assemblyNames: ['volvox'],
  adapter: { type: 'VcfAdapter', uri: 'volvox.filtered.vcf' },
  displays,
})

test('a config choosing the matrix opens this display in columns', () => {
  const out = foldRetiredMatrixDisplay(
    track([{ type: 'LinearMultiSampleVariantMatrixDisplay', height: 400 }]),
  )
  expect(out.displays).toEqual([
    {
      type: 'LinearMultiSampleVariantDisplay',
      height: 400,
      variantLayout: 'columns',
    },
  ])
})

// A session saved after switching to the matrix holds every display's entry,
// in registration order, with the reader's settings on the matrix's alone.
test('the matrix entry wins over a bare stub, under the stub id', () => {
  const out = foldRetiredMatrixDisplay(
    track([
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
  )
  expect(out.displays).toEqual([
    { type: 'LinearVariantDisplay', displayId: 't-LinearVariantDisplay' },
    {
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 't-LinearMultiSampleVariantDisplay',
      height: 400,
      variantLayout: 'columns',
    },
  ])
})

test('a configured entry for this display keeps it genomic', () => {
  const out = foldRetiredMatrixDisplay(
    track([
      { type: 'LinearMultiSampleVariantDisplay', height: 300 },
      { type: 'LinearMultiSampleVariantMatrixDisplay', height: 400 },
    ]),
  )
  expect(out.displays).toEqual([
    { type: 'LinearMultiSampleVariantDisplay', height: 300 },
  ])
})

test('the track config the plugin builds carries the matrix settings', () => {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const conf = pluginManager
    .getTrackType('VariantTrack')
    .configSchema.create(
      track([{ type: 'LinearMultiSampleVariantMatrixDisplay', height: 400 }]),
      { pluginManager },
    ) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
  const multi = conf.displays.filter(
    d => d.type === 'LinearMultiSampleVariantDisplay',
  )
  expect(multi).toHaveLength(1)
  expect(readConfObject(multi[0]!, 'variantLayout')).toBe('columns')
  expect(readConfObject(multi[0]!, 'height')).toBe(400)
})
