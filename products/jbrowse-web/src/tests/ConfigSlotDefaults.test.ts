import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

// **Why this lives in jbrowse-web.** Same reason as `PromotablePinCoverage.test.ts`
// next door: this is the only place the whole plugin set is assembled, and the
// question is about every registered schema at once. Core has no plugins and a
// plugin sees only its own types.
//
// **What it is for.** A slot's default is the value every config that doesn't
// mention the slot gets, and changing one by accident is silent — nothing
// type-checks it, no test asserts it unless some display happens to, and the
// generated config docs move with it. The case that motivated this: deleting a
// `defaultValue: undefined` line from a `maybe*` slot that overrides a base slot
// with a concrete default. The definition merge is a spread, so the slot
// inherited the base's value, stopped ever being unset, and killed
// `LinearMafDisplay`'s fit-to-content. It was caught by that display's own
// resize tests asserting on an unrelated constant — luck, not coverage.
//
// **Updating it.** A diff here is not a failure by itself; it is the one place a
// changed default shows up as a line to review. If the change is intended, run
// with `-u` and let the diff stand in the commit. If it isn't, the slot's schema
// is where to look. `ConfigSlot` refuses the two authoring mistakes outright (a
// non-`maybe*` slot with no default, a `maybe*` slot with a concrete one), so
// what reaches here is only a *changed* value.
test('every registered schema slot default', () => {
  // `createPluggableElements` is what registers each type and builds its
  // configSchema, so the schema registry is fully populated here. No
  // `configure()`: it runs every plugin's install-time work (jexl functions,
  // component wiring) and nothing here reads any of it.
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()

  const bySchema: Record<string, Record<string, string>> = {}
  for (const group of [
    'adapter',
    'connection',
    'display',
    'track',
    'text search adapter',
  ] as const) {
    for (const element of pluginManager.getElementTypesInGroup(group)) {
      const { configSchema } = element as { configSchema?: unknown }
      const definition = configSchema
        ? getConfigurationSchemaDefinition(
            configSchema as Parameters<
              typeof getConfigurationSchemaDefinition
            >[0],
          )
        : undefined
      if (!definition) {
        continue
      }
      const slots: Record<string, string> = {}
      for (const name of Object.keys(definition).sort()) {
        const entry = definition[name]
        if (!isSlotDefinitionEntry(entry)) {
          continue
        }
        // `promotedBase` is here too: it is the bottom of a promotable slot's
        // cascade, so it is that slot's real default and moves for the same
        // silent reasons. A slot declaring one has no `defaultValue` by
        // construction.
        // spelled out rather than leaning on JSON.stringify(undefined), whose
        // declared return type is a plain string even though it really answers
        // undefined — and an unset `maybe*` slot is the common case here
        slots[name] =
          entry.promotedBase === undefined
            ? `${entry.type} = ${entry.defaultValue === undefined ? 'undefined' : JSON.stringify(entry.defaultValue)}`
            : `${entry.type} promotedBase ${JSON.stringify(entry.promotedBase)}`
      }
      bySchema[`${group}: ${element.name}`] = slots
    }
  }

  // sorted so plugin registration order can never churn the snapshot
  expect(Object.keys(bySchema).length).toBeGreaterThan(80)
  expect(
    Object.fromEntries(
      Object.entries(bySchema).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  ).toMatchSnapshot()
})
