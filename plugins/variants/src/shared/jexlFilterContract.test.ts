import { getConf, setConf } from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import ldConfigSchemaFactory from '../LDDisplay/configSchemaVariant.ts'
import ldSharedModelFactory from '../LDDisplay/shared.ts'
import variantConfigSchemaFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import variantStateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import { createDisplayTestEnvironment } from './testEnv.ts'

import type { SharedLDModel } from '../LDDisplay/shared.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../LinearMultiSampleVariantDisplay/model.ts'

// The two-tier jexl-filter contract (`JexlFilterModel`), asserted on both
// displays in this plugin. Both used to implement one half of it and a different
// half each, and both failures were silent:
//
// - the multi-sample displays declared an MST property literally named
//   `jexlFilters`, which shadowed the `jexlFilters` config slot they inherit
//   from `baseLinearDisplayConfigSchema`, so a track config declaring filters
//   was read by nothing;
// - neither prefixed, so a filter written the way the base slot documents
//   (bare, because slot values are deferred-evaluation) reached
//   `stringToJexlExpression` unprefixed, which throws.
//
// `LinearBasicDisplay` has always had the whole contract; it is asserted in
// plugins/canvas's own suite.

const ldConfigSchema = ldConfigSchemaFactory()
const ld = createDisplayTestEnvironment<SharedLDModel>({
  displayName: 'LDDisplay',
  configSchema: ldConfigSchema,
  stateModel: ldSharedModelFactory(ldConfigSchema)
    .named('LDDisplay')
    .props({ type: types.literal('LDDisplay') }),
})

const variantConfigSchema = variantConfigSchemaFactory()
const variant =
  createDisplayTestEnvironment<LinearMultiSampleVariantDisplayModel>({
    displayName: 'LinearMultiSampleVariantDisplay',
    configSchema: variantConfigSchema,
    stateModel: variantStateModelFactory(variantConfigSchema),
  })

const CASES = [
  ['LDDisplay', ld.createDisplay],
  ['LinearMultiSampleVariantDisplay', variant.createDisplay],
] as const

describe.each(CASES)('%s jexl filters', (_name, createDisplay) => {
  it('applies the config slot, prefixing what it declares', () => {
    const { display } = createDisplay()
    expect(display.activeFilters()).toEqual([])

    // as the base slot documents it: no `jexl:`, because a stored prefix is
    // what marks a slot value as a callback
    setConf(display, 'jexlFilters', [
      "get(feature,'end')-get(feature,'start')<50",
    ])
    expect(display.activeFilters()).toEqual([
      "jexl:get(feature,'end')-get(feature,'start')<50",
    ])
  })

  it('leaves an already-prefixed config value alone', () => {
    const { display } = createDisplay()
    setConf(display, 'jexlFilters', ["jexl:get(feature,'name')=='BRCA1'"])
    expect(display.activeFilters()).toEqual([
      "jexl:get(feature,'name')=='BRCA1'",
    ])
  })

  it('lets the runtime override replace the config tier, empty included', () => {
    const { display } = createDisplay()
    setConf(display, 'jexlFilters', ["get(feature,'score')>10"])

    display.setJexlFilters(["jexl:get(feature,'score')>99"])
    expect(display.activeFilters()).toEqual(["jexl:get(feature,'score')>99"])

    // the case a one-tier design cannot express: clearing filters an admin
    // declared, without clearing the declaration
    display.setJexlFilters([])
    expect(display.activeFilters()).toEqual([])

    display.setJexlFilters(undefined)
    expect(display.activeFilters()).toEqual(["jexl:get(feature,'score')>10"])
  })

  it('keeps the override off the config node', () => {
    const { display } = createDisplay()
    display.setJexlFilters(["jexl:get(feature,'score')>99"])
    expect(getConf(display, 'jexlFilters')).toEqual([])
  })
})

// The property rename is the migration this needed: a session saved before it
// carries the user's filters under `jexlFilters`, and an unknown key is dropped
// in silence.
test('a pre-rename session snapshot keeps its filters', () => {
  const { view } = variant.createDisplay()
  const display = view.tracks[0]!.displays[0]!
  display.setJexlFilters(["jexl:get(feature,'score')>99"])
  const snap = getSnapshot(display) as Record<string, unknown>
  expect(snap.jexlFiltersSetting).toEqual(["jexl:get(feature,'score')>99"])

  const { jexlFiltersSetting, ...rest } = snap
  const legacy = { ...rest, jexlFilters: ["get(feature,'score')>99"] }
  const revived = variantStateModelFactory(variantConfigSchema).create(
    legacy as never,
  )
  // lifted onto the new name, and prefixed on the way in
  expect(getSnapshot(revived).jexlFiltersSetting).toEqual([
    "jexl:get(feature,'score')>99",
  ])
})
