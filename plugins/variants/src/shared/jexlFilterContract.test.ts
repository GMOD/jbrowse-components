import PluginManager from '@jbrowse/core/PluginManager'
import { getConf, readConfObject, setConf } from '@jbrowse/core/configuration'
import { activeCount } from '@jbrowse/core/ui/filterMenuItems'
import { jexlFilterNarrowing } from '@jbrowse/core/util/jexlFilters'
import CanvasPlugin from '@jbrowse/plugin-canvas'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import variantConfigSchemaFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import variantStateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import VariantsPlugin from '../index.ts'
import { createDisplayTestEnvironment } from './testEnv.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../LinearMultiSampleVariantDisplay/model.ts'

// The jexl-filter contract (`JexlFilterModel`), asserted on the
// multi-sample variant displays. They used to implement one half of it, and the
// failures were silent:
//
// - the multi-sample displays declared an MST property literally named
//   `jexlFilters`, which shadowed the config slot of that name they inherited
//   from `baseLinearDisplayConfigSchema`, so a track config declaring filters
//   was read by nothing;
// - they did not prefix, so a bare filter reached `stringToJexlExpression`,
//   which throws. The slot now refuses one.
//
// The LD display was the third participant until it stopped reading genotypes:
// it draws a file of already-computed pairs and has no features to filter.
//
// `LinearBasicDisplay` has always had the whole contract; it is asserted in
// plugins/canvas's own suite.

const variantConfigSchema = variantConfigSchemaFactory()
const variant =
  createDisplayTestEnvironment<LinearMultiSampleVariantDisplayModel>({
    displayName: 'LinearMultiSampleVariantDisplay',
    configSchema: variantConfigSchema,
    stateModel: variantStateModelFactory(variantConfigSchema),
  })

const declared =
  createDisplayTestEnvironment<LinearMultiSampleVariantDisplayModel>({
    displayName: 'LinearMultiSampleVariantDisplay',
    configSchema: variantConfigSchema,
    stateModel: variantStateModelFactory(variantConfigSchema),
    displayConfig: { filter: ["jexl:get(feature,'score')>10"] },
  })

const CASES = [
  ['LinearMultiSampleVariantDisplay', variant.createDisplay],
] as const

describe.each(CASES)('%s jexl filters', (_name, createDisplay) => {
  it('applies the config slot', () => {
    const { display } = createDisplay()
    expect(display.configuredFilters()).toEqual([])

    setConf(display, 'filter', ["jexl:get(feature,'name')=='BRCA1'"])
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'name')=='BRCA1'",
    ])
  })

  it('refuses a bare expression', () => {
    const { display } = createDisplay()
    expect(() => {
      setConf(display, 'filter', ["get(feature,'name')=='BRCA1'"])
    }).toThrow(/is not an expression/)
  })

  it('writes the slot, and a clear goes back to what the track config declares', () => {
    const { display } = declared.createDisplay()
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'score')>10",
    ])
    expect(activeCount({ filter: jexlFilterNarrowing(display) })).toBe(0)

    display.setFilter(["jexl:get(feature,'score')>99"])
    expect(getConf(display, 'filter')).toEqual(["jexl:get(feature,'score')>99"])
    expect(activeCount({ filter: jexlFilterNarrowing(display) })).toBe(1)

    display.setFilter([])
    expect(display.configuredFilters()).toEqual([])
    expect(activeCount({ filter: jexlFilterNarrowing(display) })).toBe(1)

    display.setFilter(undefined)
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'score')>10",
    ])
    expect(activeCount({ filter: jexlFilterNarrowing(display) })).toBe(0)
  })
})

test("a v4.3 session's jexlFiltersSetting on a variant display lands in its filter slot, prefixed", () => {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new CanvasPlugin(),
    new VariantsPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const { configSchema, retiredState } = pluginManager.getDisplayType(
    'LinearVariantDisplay',
  )
  const lifted = retiredState!.lift({
    jexlFiltersSetting: ["get(feature,'score')>99"],
  })
  const conf = configSchema.create(
    { type: 'LinearVariantDisplay', displayId: 'd', ...lifted },
    { pluginManager },
  )
  expect(readConfObject(conf, 'filter')).toEqual([
    "jexl:get(feature,'score')>99",
  ])
})
