import PluginManager from '@jbrowse/core/PluginManager'
import createJexlInstance from '@jbrowse/core/util/jexl'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import baseConfigSchema from '../LinearBasicDisplay/baseConfigSchema.ts'
import { tooltipReader } from './collect/glyphColors.ts'
import { DEFAULT_TOOLTIP, defaultTooltip } from './featureTooltip.ts'
import { readConfigValueSafe } from './renderConfig.ts'
import { mockDisplayConfig } from './testUtils.ts'

const jexl = createJexlInstance()
const config = { ...mockDisplayConfig(), tooltip: DEFAULT_TOOLTIP }

function throughJexl(feature: SimpleFeature) {
  return String(
    readConfigValueSafe<unknown>(config, 'tooltip', feature, jexl, ''),
  )
}

const feature = (data: Record<string, unknown>) =>
  new SimpleFeature({
    uniqueId: 'u1',
    refName: 'chr1',
    start: 0,
    end: 10,
    ...data,
  })

test('the native default answers what the jexl default answers', () => {
  for (const data of [
    { _mouseOver: 'custom', name: 'n' },
    { name: 'BRCA1' },
    { function: 'stem_loop' },
    { id: 'gene-1' },
    { name: '', function: 'f' },
    { name: 0, id: 'x' },
    {},
  ]) {
    const f = feature(data)
    expect(defaultTooltip(f)).toBe(throughJexl(f))
  }
})

test('the schema default is the one the worker reads natively', () => {
  const schema = baseConfigSchema(new PluginManager([]))
  expect(schema.create().tooltip.field).toBe(DEFAULT_TOOLTIP)
})

test('a written tooltip field evaluates through jexl', () => {
  const read = tooltipReader(
    { ...config, tooltip: `jexl:'start ' + get(feature,'start')` },
    jexl,
  )
  expect(read(feature({}))).toBe('start 0')
  expect(tooltipReader(config, jexl)).toBe(defaultTooltip)
})
