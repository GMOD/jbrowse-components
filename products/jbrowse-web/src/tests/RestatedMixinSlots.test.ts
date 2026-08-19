import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'
import { legendMixinSlots } from '@jbrowse/plugin-linear-genome-view'
import { wiggleCommonExtraSlots } from '@jbrowse/plugin-wiggle'

import corePlugins from '../corePlugins.ts'

// **Why this lives in jbrowse-web.** Same reason as `ConfigSlotDefaults.test.ts`
// and `PromotablePinCoverage.test.ts` next door: the question is about every
// registered schema at once, and this is the only place the whole plugin set is
// assembled.
//
// **What it is for.** Two cross-cutting mixins reach slots that no shared field
// table can hold, because the composing schemas disagree about the parts that
// are genuinely per display — `showLegend`'s `promotedBase` (off for a Hi-C
// colour scale, on for a variant genotype key) and `summaryScoreMode`'s default
// (`whiskers` vs `avg`). What they agree on is the slot's TYPE, which is the
// only part the mixin's host cast needs, so each mixin restates that much beside
// itself.
//
// A restatement nothing compares to the thing it restates is a copy. Change one
// of these schemas to a plain `boolean` and the mixin keeps compiling — the cast
// is a cast — and the failure surfaces as `resolveConf` throwing "not
// promotable" at the first menu click on that one display. This is the
// comparison, so it surfaces here instead.
//
// **What it adds over the guards already there.** `ConfigSlot` refuses a
// `promotedBase` the slot cannot hold, so changing a type and leaving the
// sentinel behind already dies at plugin creation. What gets past that is a
// change made *consistently* — `maybeNumber` with `promotedBase: 0` — and a slot
// that quietly stops being promotable, whose only other symptom is `resolveConf`
// throwing at the first menu click on the one display that regressed. Both are
// checked here; both were sabotage-verified.
//
// A NEW display composing either mixin is the case this really guards: it
// declares the slot by hand, nothing points it at the existing spellings, and
// getting the type wrong is silent everywhere else.
//
// The counts read higher than the prose elsewhere: `showLegend` has six
// hand-written declarations in source and ten registered display types, because
// two of those declarations are in shared schema factories that two displays
// each instantiate.
const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

// Every `{ slotName, declaringSchema, type }` a registered display declares,
// including inherited slots — `getConfigurationSchemaDefinition` returns the
// schema's own entries, which is what we want: the point is to catch a
// hand-written declaration, and an inherited one has no second spelling to
// disagree with.
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
    // Not a `toBeGreaterThan(0)` buried in the loop: a slot that stopped being
    // declared anywhere would otherwise pass by iterating zero times, which is
    // the shape of failure this whole file exists to catch.
    it(`${slotName} is declared by at least one display`, () => {
      expect(declarationsOf(slotName).length).toBeGreaterThan(0)
    })

    it(`${slotName} has the restated type wherever it is declared`, () => {
      expect(
        declarationsOf(slotName).map(d => `${d.display}: ${d.type}`),
      ).toEqual(
        declarationsOf(slotName).map(d => `${d.display}: ${shape.type}`),
      )
    })

    // The mixin reads this slot through `resolveConf`, which throws on a
    // non-promotable slot — so a promotable restatement needs `promotedBase`
    // present on every real declaration, whatever each sets it to.
    if ('promotedBase' in shape) {
      it(`${slotName} is promotable wherever it is declared`, () => {
        expect(
          declarationsOf(slotName).filter(
            d => !d.keys.includes('promotedBase'),
          ),
        ).toEqual([])
      })
    }
  }
})
