import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

// 36 promotable slots across five plugins end their description with what the
// cascade falls back to — "falling back to off", "falling back to 2",
// "falling back to `fixed`". That sentence is the only place a config page
// tells a reader what an unset slot resolves to, and nothing kept it equal to
// the `promotedBase` beside it: change the sentinel and the prose goes on
// promising the old value, on a generated page, silently.
//
// Here rather than in core for the same reason as `ConfigSlotDefaults.test.ts`
// next door — the question is about every registered schema at once, and this
// is the only place the whole plugin set is assembled.
//
// The prose is deliberately what gets parsed, not a separate table: a table
// would be one more thing to keep in step, which is the failure being closed.
const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

// `on`/`off` for a boolean, a bare number, and a backticked member for an enum
// — the three shapes the sentence takes today. An unrecognized one fails rather
// than passing quietly, since a shape this can't read is a slot it isn't
// checking.
function promisedValue(text: string) {
  if (text === 'on' || text === 'off') {
    return text === 'on'
  }
  if (/^`[^`]+`$/.test(text)) {
    return text.slice(1, -1)
  }
  const n = Number(text)
  return Number.isNaN(n) ? text : n
}

function fallbackPromises() {
  const found: { where: string; promised: unknown; promotedBase: unknown }[] =
    []
  for (const group of [
    'adapter',
    'connection',
    'display',
    'track',
    'text search adapter',
  ] as const) {
    for (const element of pluginManager.getElementTypesInGroup(group)) {
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
      for (const [slot, entry] of Object.entries(definition ?? {})) {
        if (!isSlotDefinitionEntry(entry)) {
          continue
        }
        const promise = /falling back to ([^;,.\s]+)/.exec(
          String(entry.description ?? ''),
        )
        if (promise?.[1]) {
          found.push({
            where: `${name}.${slot}`,
            promised: promisedValue(promise[1]),
            promotedBase: entry.promotedBase,
          })
        }
      }
    }
  }
  return found.sort((a, b) => a.where.localeCompare(b.where))
}

const promises = fallbackPromises()

test('the sentence is still in the schemas at all', () => {
  expect(promises.length).toBeGreaterThan(30)
})

test('every "falling back to" sentence matches its promotedBase', () => {
  expect(
    promises.map(p => `${p.where}: ${JSON.stringify(p.promised)}`),
  ).toEqual(promises.map(p => `${p.where}: ${JSON.stringify(p.promotedBase)}`))
})
