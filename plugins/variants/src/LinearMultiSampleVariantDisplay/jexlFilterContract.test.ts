import PluginManager from '@jbrowse/core/PluginManager'
import { setConf } from '@jbrowse/core/configuration'
import { activeCount } from '@jbrowse/core/ui/filterMenuItems'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { filterFieldNarrowing } from '@jbrowse/core/util/jexlFilters'
import CanvasPlugin from '@jbrowse/plugin-canvas'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import VariantsPlugin from '../index.ts'
import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import variantConfigSchemaFactory from './configSchema.ts'
import variantStateModelFactory from './model.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'

// The jexl-filter contract (`JexlFilterModel`), asserted on the
// multi-sample variant display. It used to implement one half of it, and the
// failures were silent:
//
// - the display declared an MST property literally named
//   `jexlFilters`, which shadowed the config slot of that name it inherited
//   from `baseLinearDisplayConfigSchema`, so a track config declaring filters
//   was read by nothing;
// - it did not prefix, so a bare filter reached `stringToJexlExpression`,
//   which throws. The `filter` list refuses one, and a bare string that
//   holds no expression names a field.
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

    setConf(display.configuration, 'filter', [
      "jexl:get(feature,'name')=='BRCA1'",
    ])
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'name')=='BRCA1'",
    ])
  })

  it('reads a bare string as a field, not an expression', () => {
    const { display } = createDisplay()
    setConf(display.configuration, 'filter', ['name'])
    expect(display.configuredFilters()).toEqual([])
    expect(predicatesOf(display.configuration.filter)).toEqual([
      { field: 'name', equal: true },
    ])
  })

  it('refuses an expression written without its prefix', () => {
    const { display } = createDisplay()
    expect(() => {
      setConf(display.configuration, 'filter', ["get(feature,'name')=='BRCA1'"])
    }).toThrow(/reads as an expression/)
  })

  it('keeps the site fields through an expression write', () => {
    const { display } = createDisplay()
    display.setMinMinorAlleleFrequency(0.1)
    display.setFilter(["jexl:get(feature,'score')>99"])
    expect(predicatesOf(display.configuration.filter)).toEqual([
      { field: 'minorAlleleFrequency', gte: 0.1 },
      { field: "jexl:get(feature,'score')>99", equal: true },
    ])
  })

  it('writes the slot, and a clear goes back to what the track config declares', () => {
    const { display } = declared.createDisplay()
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'score')>10",
    ])
    expect(
      activeCount({ filter: filterFieldNarrowing(display, () => true) }),
    ).toBe(0)

    display.setFilter(["jexl:get(feature,'score')>99"])
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'score')>99",
    ])
    expect(
      activeCount({ filter: filterFieldNarrowing(display, () => true) }),
    ).toBe(1)

    display.setFilter([])
    expect(display.configuredFilters()).toEqual([])
    expect(
      activeCount({ filter: filterFieldNarrowing(display, () => true) }),
    ).toBe(1)

    display.setFilter(undefined)
    expect(display.configuredFilters()).toEqual([
      "jexl:get(feature,'score')>10",
    ])
    expect(
      activeCount({ filter: filterFieldNarrowing(display, () => true) }),
    ).toBe(0)
  })

  it('counts and clears a site predicate the menu writes no expression for', () => {
    const { display } = declared.createDisplay()
    setConf(display.configuration, 'filter', [
      ...predicatesOf(display.configuration.filter),
      { field: 'QUAL', gte: 30 },
    ])
    const filter = () => filterFieldNarrowing(display, () => true)
    expect(activeCount({ filter: filter() })).toBe(1)
    filter().clear()
    expect(predicatesOf(display.configuration.filter)).toEqual([
      { field: "jexl:get(feature,'score')>10", equal: true },
    ])
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
  expect(predicatesOf(conf.filter)).toEqual([
    { field: "jexl:get(feature,'score')>99", equal: true },
  ])
})
