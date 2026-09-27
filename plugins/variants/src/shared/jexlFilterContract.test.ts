import { getConf, setConf } from '@jbrowse/core/configuration'

import variantConfigSchemaFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import variantStateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import { createDisplayTestEnvironment } from './testEnv.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../LinearMultiSampleVariantDisplay/model.ts'

// The two-tier jexl-filter contract (`JexlFilterModel`), asserted on the
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

const CASES = [
  ['LinearMultiSampleVariantDisplay', variant.createDisplay],
] as const

describe.each(CASES)('%s jexl filters', (_name, createDisplay) => {
  it('applies the config slot', () => {
    const { display } = createDisplay()
    expect(display.activeFilters()).toEqual([])

    setConf(display, 'filter', ["jexl:get(feature,'name')=='BRCA1'"])
    expect(display.activeFilters()).toEqual([
      "jexl:get(feature,'name')=='BRCA1'",
    ])
  })

  it('refuses a bare expression', () => {
    const { display } = createDisplay()
    expect(() => {
      setConf(display, 'filter', ["get(feature,'name')=='BRCA1'"])
    }).toThrow(/is not an expression/)
  })

  it('lets the runtime override replace the config tier, empty included', () => {
    const { display } = createDisplay()
    setConf(display, 'filter', ["jexl:get(feature,'score')>10"])

    display.setFilter(["jexl:get(feature,'score')>99"])
    expect(display.activeFilters()).toEqual(["jexl:get(feature,'score')>99"])

    // the case a one-tier design cannot express: clearing filters an admin
    // declared, without clearing the declaration
    display.setFilter([])
    expect(display.activeFilters()).toEqual([])

    display.setFilter(undefined)
    expect(display.activeFilters()).toEqual(["jexl:get(feature,'score')>10"])
  })

  it("loads a v4.3 session's jexlFiltersSetting, prefixed", () => {
    const { display } = createDisplay({
      displaySnapshot: { jexlFiltersSetting: ["get(feature,'score')>99"] },
    })
    expect(display.filterSetting).toEqual(["jexl:get(feature,'score')>99"])
  })

  it('keeps the override off the config node', () => {
    const { display } = createDisplay()
    display.setFilter(["jexl:get(feature,'score')>99"])
    expect(getConf(display, 'filter')).toEqual([])
  })
})
