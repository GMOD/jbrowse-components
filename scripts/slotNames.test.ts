/**
 * @jest-environment node
 */
import { configJsonSchema } from '../products/jbrowse-cli/src/commands/validate/configSchema.generated.ts'

// ADR-238: a part turns off through its `show` member and a threshold is a
// filter predicate, so a show*, hide*, min* or max* config slot is a second
// spelling of words the vocabulary already has. Each live one is listed here
// with why it stays, and an entry that stops matching fails, so the list only
// shrinks. View launch keys and app-written state are out of scope.
const PENDING =
  'pending a ruling: agent-docs/ideas/waiting-on-a-call/vega-lite-layout-and-multiway-leftovers.md'

const ALLOWED: Record<string, string> = {
  hideUris: "the About dialog's option, not a drawn part",
  maxDepth: "the details panel's nesting limit, not a drawn part",
  minGcPercent: "an adapter's guide search parameter, not a display filter",
  maxGcPercent: "an adapter's guide search parameter, not a display filter",
  maxLayoutHeight: 'the pileup layout cap, unchanged by ADR-240',
  maxGapMultiple:
    'a line-break threshold, which Vega-Lite spells only as invalid data',
  minBpPerPx: PENDING,
  maxBpPerPx: PENDING,
  maxFeatureScreenDensity: PENDING,
  maxLabelFeatureDensity: PENDING,
  maxDescriptionFeatureDensity: PENDING,
  minWidthPx: PENDING,
  showLaneTicks: PENDING,
}

type Schema = Record<string, unknown>

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const OUT_OF_SCOPE = /(ViewKeys|State|Snapshot)$|^Session$/

function slotNames(schema: Schema) {
  const names = new Set<string>()
  function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk)
    } else if (isSchema(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'properties' && isSchema(value)) {
          for (const [name, slot] of Object.entries(value)) {
            // displayDefaults mirrors display slots the walk meets at home
            if (name !== 'displayDefaults' && !(slot as Schema).deprecated) {
              names.add(name)
              walk(slot)
            }
          }
        } else if (key !== '$defs') {
          walk(value)
        }
      }
    }
  }
  const defs = isSchema(schema.$defs) ? schema.$defs : {}
  for (const [name, def] of Object.entries(defs)) {
    if (!OUT_OF_SCOPE.test(name)) {
      walk(def)
    }
  }
  return [...names].filter(name => /^(show|hide|min|max)[A-Z]/.test(name))
}

test('no config slot spells a toggle or threshold outside the vocabulary', () => {
  expect(slotNames(configJsonSchema).sort()).toEqual(
    Object.keys(ALLOWED).sort(),
  )
})
