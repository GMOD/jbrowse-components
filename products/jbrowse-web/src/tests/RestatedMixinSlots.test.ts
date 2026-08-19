import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'
import { legendMixinSlots } from '@jbrowse/plugin-linear-genome-view'
import { wiggleCommonExtraSlots } from '@jbrowse/plugin-wiggle'

import corePlugins from '../corePlugins.ts'

// `LegendMixin` and `WiggleCommonMixin` reach a slot no shared field table can
// hold, because the composing schemas disagree about the part that is genuinely
// per display — `showLegend`'s `promotedBase`, `defaultRendering`'s enum. They
// agree about the TYPE, which is all the mixin's host cast needs, so each mixin
// restates that much beside itself. This is the comparison that keeps the
// restatement honest; it lives in jbrowse-web for the same reason as
// `ConfigSlotDefaults.test.ts` next door — the only place the whole plugin set
// is assembled.
//
// `ConfigSlot` already refuses a `promotedBase` the slot cannot hold, so
// changing a type and leaving the sentinel dies at plugin creation. Two cases
// get past it, and both are sabotage-verified here: a change made
// *consistently* (`maybeNumber` with `promotedBase: 0`), and a slot that
// quietly stops being promotable, whose only other symptom is `resolveConf`
// throwing at the first menu click on the one display that regressed.
//
// **One direction only, and deliberately.** This asks whether every display
// that DECLARES the slot spells it the way the mixin assumes. It does not ask
// the converse — whether every display composing the mixin declares the slot at
// all — because MST erases the composition (a composed model keeps neither its
// parts' names nor their member lists, so no runtime walk can recover it) and
// because that direction does not need catching here: the mixin's getter is
// `resolveConf`, which throws on a missing or non-promotable slot, and
// `MultiSampleVariantOverlay` reads it every render. A display composing
// without declaring throws the first time it draws. `PromotablePinCoverage.test.ts`
// is where that becomes a CI failure rather than a first-use one — it opens a
// live display per type and builds its menu, which reads the slot.
const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

// `getConfigurationSchemaDefinition` merges in what `baseConfiguration`
// declared, so a display inheriting the slot is listed alongside the one that
// hand-wrote it. `showLegend` reaches nine displays off six declarations: two
// of the six are shared factories two displays each instantiate, and
// LGVSyntenyDisplay inherits the alignments one.
function declarationsOf(slotName: string) {
  const found: { display: string; type: string; keys: string[] }[] = []
  for (const element of pluginManager.getElementTypesInGroup('display')) {
    const { name, configSchema } = element as {
      name: string
      configSchema?: unknown
    }
    const definition = configSchema
      ? getConfigurationSchemaDefinition(
          configSchema as Parameters<
            typeof getConfigurationSchemaDefinition
          >[0],
        )
      : undefined
    const entry = definition?.[slotName]
    if (entry && isSlotDefinitionEntry(entry)) {
      found.push({
        display: name,
        type: String(entry.type),
        keys: Object.keys(entry),
      })
    }
  }
  return found.sort((a, b) => a.display.localeCompare(b.display))
}

describe.each([
  ['legendMixinSlots', legendMixinSlots as Record<string, { type: string }>],
  [
    'wiggleCommonExtraSlots',
    wiggleCommonExtraSlots as Record<string, { type: string }>,
  ],
])('%s matches every real declaration', (_table, restated) => {
  for (const [slotName, shape] of Object.entries(restated)) {
    const declarations = declarationsOf(slotName)

    // Its own test rather than a guard inside the next one: a slot that stopped
    // being declared anywhere would otherwise pass by iterating zero times,
    // which is the shape of failure this file exists to catch.
    it(`${slotName} is declared by at least one display`, () => {
      expect(declarations.length).toBeGreaterThan(0)
    })

    it(`${slotName} has the restated type wherever it is declared`, () => {
      expect(declarations.map(d => `${d.display}: ${d.type}`)).toEqual(
        declarations.map(d => `${d.display}: ${shape.type}`),
      )
    })

    // The mixin reads a promotable slot through `resolveConf`, which throws on
    // a non-promotable one — so `promotedBase` has to be present on every real
    // declaration, whatever each sets it to.
    if ('promotedBase' in shape) {
      it(`${slotName} is promotable wherever it is declared`, () => {
        expect(
          declarations.filter(d => !d.keys.includes('promotedBase')),
        ).toEqual([])
      })
    }
  }
})
