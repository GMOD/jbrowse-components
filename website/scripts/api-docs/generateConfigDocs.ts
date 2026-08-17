import fs from 'fs'

import slugify from 'slugify'
import * as ts from 'typescript'

import {
  enumConstantValues,
  numericConstantValue,
  scalarConstantValue,
  slotFieldConstantPairs,
  slotFieldFactoryPairs,
} from './enumConstants.ts'
import { writeDoc } from './format.ts'
import {
  assertSingleHeader,
  assertUniquePages,
  codeBlock,
  codeCell,
  collectTransitive,
  docPage,
  escapeRegExp,
  exampleCell,
  exampleSection,
  filterUnseenByName,
  headerGaps,
  lookupByIdOrName,
  mapByKey,
  markdownTable,
  overviewSection,
  parseNode,
  proseCell,
  repoRelative,
  rewriteMarkerBlock,
  section,
  stripPropertyName,
  suffixCategory,
  withHeaders,
} from './util.ts'

import type { Example, ExtractedNode } from './util.ts'

interface Item {
  name: string
  docs: string
  examples: Example[]
  category?: string
  code: string
}
interface ConfigHeader {
  name: string
  docs: string
  examples: Example[]
  // `#gotcha` blocks, rendered as caution callouts under the example
  gotchas: string[]
  id: string
  // "file:pos" identity of the declaration this #config sits on. A deriving
  // config's `baseConfiguration:` slot resolves (alias-followed) to this same
  // id, so it's how we link the derivation graph.
  declId?: string
  // explicit #category tag value, e.g. "assemblyManagement" — wins over the
  // name-suffix heuristic in configCategory() when present
  category?: string
  // explicit #trackType tag value, e.g. "AlignmentsTrack" — the track type an
  // adapter's example is wrapped in to show a full track config (see
  // wrapAdapterExample). Adapter pages only.
  trackType?: string
}
export interface Config {
  header?: ConfigHeader
  derives?: Item
  // declId the `baseConfiguration:` expression resolves to (the base config)
  baseDeclId?: string
  // config-name fallback for dynamic base references (getDisplayType('Name'))
  baseConfigName?: string
  identifier?: Item
  preProcess?: Item
  slots: Item[]
  // slots pulled in by spreading a shared slot table, folded into `slots` by
  // mergeSpreadSlots once accumulation is done (see spreadSlots)
  spreadSlots?: Item[]
  filename: string
}
type ConfigWithHeader = Config & { header: ConfigHeader }
interface ConfigIndex {
  byDeclId: Map<string, ConfigWithHeader>
  byName: Map<string, ConfigWithHeader>
}

// Slots a schema pulls in by spreading a shared slot table
// (`...wiggleConfigSchemaFields`). They are real slots of this schema but carry
// no `#slot` JSDoc of their own — the table lives in a file with no `#config`, so
// tagging them there would bucket them under no config at all — which is why they
// were missing from the generated pages entirely. Recovered from the `#config`
// node's own source: every spread of a name the slot-table index knows (see
// enumConstants.ts) contributes its properties, in declaration order.
//
// **A spread inside a nested sub-schema keeps its parent's key**, so
// `index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields })` documents
// `index.indexType` rather than a top-level `indexType`. That is the same
// dotted name a `#slot index.indexType` JSDoc produces by hand, which is what
// nine tabix adapters wrote before the table was shared — without the prefix
// they would each have grown two slots at the wrong level, which reads as a
// schema change rather than as a docs bug.
// The two ways a schema names a shared slot table: `...tabixIndexFields` (a
// const) and `...heightModeConfigSchemaFields({ … })` (a factory taking the
// per-display prose). Only the first was recognized, so every factory's slots
// were absent from the pages of every schema spreading one.
function spreadPairs(expr: ts.Expression, sf: ts.SourceFile) {
  if (ts.isIdentifier(expr)) {
    return slotFieldConstantPairs(expr.text)
  }
  if (!ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression)) {
    return undefined
  }
  // One object-literal argument, matching the single destructured parameter the
  // factory index accepts. Anything else is not a shape this can substitute
  // into, and gets no entry rather than a half-substituted one.
  const [arg, ...rest] = expr.arguments
  if (!arg || rest.length || !ts.isObjectLiteralExpression(arg)) {
    return undefined
  }
  const args = new Map<string, string>()
  for (const p of arg.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
      args.set(p.name.text, p.initializer.getText(sf))
    }
  }
  return slotFieldFactoryPairs(expr.expression.text, args)
}

function spreadSlots(configNode: string): Item[] {
  const sf = ts.createSourceFile(
    'config.ts',
    configNode,
    ts.ScriptTarget.Latest,
    true,
  )
  const slots: Item[] = []
  const visit = (node: ts.Node, prefix: string) => {
    if (ts.isSpreadAssignment(node)) {
      const pairs = spreadPairs(node.expression, sf)
      for (const [name, value] of pairs ?? []) {
        slots.push({
          name: `${prefix}${name}`,
          docs: '',
          examples: [],
          code: `${name}: ${value}`,
        })
      }
    }
    // A property whose value is a nested `ConfigurationSchema(...)` opens a
    // level; anything else keeps the prefix it was reached with.
    const nested =
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'ConfigurationSchema'
        ? `${prefix}${node.name.text}.`
        : prefix
    ts.forEachChild(node, child => {
      visit(child, nested)
    })
  }
  ts.forEachChild(sf, child => {
    visit(child, '')
  })
  return slots
}

// Fold each config's spread-in slots into its slot list, after accumulation so a
// `#slot` the schema declares itself always wins over the shared table's version
// of the same name. Idempotent, so both writers below can call it.
function mergeSpreadSlots(byFile: Record<string, Config>) {
  for (const config of Object.values(byFile)) {
    const declared = new Set(config.slots.map(s => s.name))
    config.slots = [
      ...config.slots,
      ...(config.spreadSlots ?? []).filter(s => !declared.has(s.name)),
    ]
    config.spreadSlots = undefined
  }
}

// Route one extracted node into its file's config bucket. Called from the shared
// single-program-load driver in generate.ts.
export function accumulateConfig(
  byFile: Record<string, Config>,
  obj: ExtractedNode,
) {
  const fn = obj.filename
  byFile[fn] ??= { slots: [], filename: repoRelative(fn) }
  const file = byFile[fn]
  const item = parseNode(obj)

  if (obj.type === 'config') {
    assertSingleHeader({
      filename: file.filename,
      tag: 'config',
      existing: file.header?.name,
      incoming: item.name,
    })
    // A `#config` block documents a schema, so it has to SIT on one — the
    // declaration it precedes is what gets extracted with it, and the source of
    // that declaration is what slot recovery reads. A block parked above a
    // neighbouring `normalizeSnapshot` still produced a page, because slots are
    // collected from their own `#slot` tags file-wide; it silently produced an
    // EMPTY node, so anything read off the schema's source found nothing. Nine
    // adapters were in that state and five lost both their `index.*` rows the
    // day a shared slot table arrived.
    // `types.model(` as well as `ConfigurationSchema(`: the root config is a
    // factory returning the former, and it is documenting the thing it returns
    // either way. A `normalizeSnapshot` body has neither, which is the whole
    // set of offenders.
    if (
      !obj.node.includes('ConfigurationSchema(') &&
      !obj.node.includes('types.model(')
    ) {
      throw new Error(
        `${file.filename}: the \`#config ${item.name}\` block sits on a declaration that is not a schema — move it directly above the schema it documents. Everything read off the schema's own source (spread-in slot tables) is silently empty where it is.`,
      )
    }
    file.header = {
      name: item.name,
      docs: item.docs,
      examples: item.examples,
      gotchas: item.gotchas,
      id: slugify(item.name, { lower: true }),
      declId: obj.selfDeclId,
      category: item.category,
      trackType: item.trackType,
    }
    // assigned, not appended: extractWithComment can emit one declaration twice
    // (the variable statement and its inner declaration), and appending would
    // then document every spread slot twice
    file.spreadSlots = spreadSlots(obj.node)
  } else if (obj.type === 'baseConfiguration') {
    file.derives = item
    file.baseDeclId = obj.baseDeclId
    file.baseConfigName = obj.baseConfigName
  } else if (obj.type === 'identifier') {
    file.identifier = item
  } else if (obj.type === 'preProcessSnapshot') {
    file.preProcess = item
  } else if (obj.type === 'slot') {
    file.slots.push(item)
  }
}

// Resolve a config's documented base, or undefined: by declaration identity
// first, else by the config name recovered from a dynamic getDisplayType('Name')
// reference, and only when the config actually derives from something.
function resolveBase(config: Config, index: ConfigIndex) {
  return config.derives
    ? lookupByIdOrName(
        index.byDeclId,
        index.byName,
        config.baseDeclId,
        config.baseConfigName,
      )
    : undefined
}

// The transitive base chain (direct base first), via the shared graph walk.
function collectBaseConfigs(config: ConfigWithHeader, index: ConfigIndex) {
  return collectTransitive(
    config,
    c => c.header.id,
    c => {
      const base = resolveBase(c, index)
      return base ? [base] : []
    },
  )
}

// Every slot available on this config — its own first, then each base's — as
// one row apiece, so a reader configuring this track sees the whole surface in
// one scan without chasing links.
//
// Each base's slots sit under a header row naming it rather than repeating the
// base link in a "From" column of their own: LinearBasicDisplay printed the
// same LinearCanvasBaseDisplay link on 21 consecutive rows, spending a column's
// width to say once per row what one row can say for the run. The header also
// gives the run a boundary, so a reader who only wants this config's slots can
// stop at the first one.
//
// The seen-by-name set makes a slot the config (or a closer base) redeclares
// skip every farther base — otherwise an override (e.g. LGVSyntenyDisplay's
// `colorBy`, which moves `promotedBase` to `strand`) also lists the shadowed
// base definition (`normal`), which reads as a live alternative rather than
// superseded history. The override's own row already carries the base's other
// fields, since `resolveInheritedSlotMeta` merges them the way the runtime does.
function slotsTable(ownSlots: Item[], bases: ConfigWithHeader[]) {
  const seen = new Set<string>()
  const groups = [
    { slots: filterUnseenByName(seen, ownSlots), from: undefined },
    ...bases.map(config => ({
      slots: filterUnseenByName(seen, config.slots),
      from: `[${config.header.name}](../${config.header.id})`,
    })),
  ]
  const all = groups.flatMap(g => g.slots)
  const rows = groups.flatMap(({ slots, from }) => {
    const visible = slots.filter(
      s => !isContainerSlot(s, slotMetaFor(s).meta, all),
    )
    return visible.length
      ? [
          ...(from === undefined ? [] : [slotGroupRow(from, visible.length)]),
          ...visible.map(s => slotRow(s)),
        ]
      : []
  })
  return markdownTable(['Slot', 'Description'], rows)
}

// Name-suffix heuristic for a config's sidebar category, checked in order.
const CONFIG_CATEGORIES: [string, string][] = [
  ['Adapter', 'Adapter'],
  ['Track', 'Track'],
  ['Display', 'Display'],
  ['Connection', 'Connection'],
  ['InternetAccount', 'Internet Account'],
]

function configCategory(name: string, explicit?: string): string {
  return suffixCategory(name, explicit, CONFIG_CATEGORIES)
}

// Everything renderConfig/displayTypesSection need to resolve a Track's
// "Display types" links: which Displays declare `trackType: 'ThisTrack'`
// (see DisplayTrackLink in util.ts), the config-doc index to turn a Display
// name into a page, and which Displays also have a documented state model.
// displayToTrackType/adaptersByTrack additionally link a display or track to the
// data adapters that feed it (see compatibleAdaptersSection).
interface DisplayLinkContext {
  displayTypesByTrack: Map<string, string[]>
  displayToTrackType: Map<string, string>
  adaptersByTrack: Map<string, string[]>
  byName: Map<string, ConfigWithHeader>
  modelNames: Set<string>
  // reverse of each config's `baseConfiguration:` — the concrete configs that
  // inherit a base's slots (see extendedByLines)
  extendedBy: Map<string, string[]>
}

// Reverse the base-config graph: base name -> the configs deriving from it.
// Every page's "From" column links a slot up to the base that defines it, so a
// `#slot-` deep link can land on a base schema — a name that is never written
// in a config. This is the only route back down to something pasteable.
// Sorted, because `configs` arrives in `Object.values(byFile)` order — the order
// the TypeScript program visited its sources, which follows the module graph.
// That is deterministic for a given tree AND install and stable across neither,
// so the list permuted whenever the package graph moved and the churn landed on
// whoever next added a dependency, reading as theirs.
function extendedByMap(configs: ConfigWithHeader[], index: ConfigIndex) {
  const map = new Map<string, string[]>()
  for (const config of configs) {
    const base = resolveBase(config, index)
    if (base) {
      const name = base.header.name
      map.set(name, [...(map.get(name) ?? []), config.header.name])
    }
  }
  for (const names of map.values()) {
    names.sort((a, b) => a.localeCompare(b))
  }
  return map
}

// The track type a config is associated with: a Track config is its own track
// type; a Display resolves through its DisplayType registration. Used to find
// the adapters that supply it.
function relatedTrackType(name: string, links: DisplayLinkContext) {
  return links.adaptersByTrack.has(name) || links.displayTypesByTrack.has(name)
    ? name
    : links.displayToTrackType.get(name)
}

// One bullet per related link, prefixed with the kind of page it points to
// (Track/Adapter/Display/Guide/...), so the whole "Related links" section
// stays a single flat scannable list instead of a comma-joined line or its
// own subsection per relationship.
function relatedLine(kind: string, label: string) {
  return `- **${kind}:** ${label}`
}

// The data adapters that feed a track/display, each declared via an adapter's
// `#trackType` tag. Gives e.g. LinearAlignmentsDisplay -> BamAdapter,
// CramAdapter, and AlignmentsTrack -> the same — so a reader configuring the
// display or track sees which data formats it accepts.
function compatibleAdaptersLines(name: string, links: DisplayLinkContext) {
  const trackType = relatedTrackType(name, links)
  return (trackType ? (links.adaptersByTrack.get(trackType) ?? []) : [])
    .map(adapterName => links.byName.get(adapterName))
    .filter((a): a is ConfigWithHeader => Boolean(a))
    .map(a => relatedLine('Adapter', `[${a.header.name}](../${a.header.id})`))
}

// Reverse-links a Track config to the Display types that attach to it.
// Displays parameterized from a shared factory at runtime (e.g.
// LDDisplay/LDTrackDisplay) carry no individually-tagged #config and so
// resolve to nothing here; silently skipped, same as an empty Slots section.
function displayTypesLines(name: string, links: DisplayLinkContext) {
  return (links.displayTypesByTrack.get(name) ?? []).flatMap(displayName => {
    const display = links.byName.get(displayName)
    if (!display) {
      return []
    }
    const modelLink = links.modelNames.has(displayName)
      ? ` ([state model](../../models/${display.header.id}))`
      : ''
    return [
      relatedLine(
        'Display',
        `[${displayName}](../${display.header.id})${modelLink}`,
      ),
    ]
  })
}

// Re-indent a bare adapter object so it nests cleanly as the 2-space-indented
// `adapter:` value of a track config, with a trailing comma. Prettier does not
// reformat embedded markdown code fences, so we emit final indentation here.
function adapterValueLines(code: string) {
  const [first, ...rest] = code.split('\n')
  const lines = [`  adapter: ${first}`, ...rest.map(line => `  ${line}`)]
  lines[lines.length - 1] += ','
  return lines
}

// A synteny track spans two assemblies. Keep the track's assemblyNames
// consistent with the adapter snapshot it wraps: reuse the adapter's own
// query/target (or assemblyNames) rather than a generic placeholder that would
// contradict it.
function syntenyAssemblyNames(adapterCode: string) {
  const query = /queryAssembly:\s*['"]([^'"]*)['"]/.exec(adapterCode)
  const target = /targetAssembly:\s*['"]([^'"]*)['"]/.exec(adapterCode)
  const names = /assemblyNames:\s*(\[[^\]]*\])/.exec(adapterCode)
  return query && target
    ? `['${query[1]}', '${target[1]}']`
    : (names?.[1] ?? "['assembly1', 'assembly2']")
}

// The full track config that nests an adapter snapshot, shaped per track type:
// a reference sequence track has no assemblyNames (it is the assembly's own
// sequence) and synteny spans two assemblies, while ordinary data tracks take a
// single assembly.
function trackConfigLines(trackType: string, adapterCode: string) {
  const adapter = adapterValueLines(adapterCode)
  if (trackType === 'ReferenceSequenceTrack') {
    return [
      '{',
      "  type: 'ReferenceSequenceTrack',",
      "  trackId: 'my_assembly-ReferenceSequenceTrack',",
      ...adapter,
      '}',
    ]
  }
  const assemblyNames =
    trackType === 'SyntenyTrack'
      ? syntenyAssemblyNames(adapterCode)
      : "['hg38']"
  return [
    '{',
    `  type: '${trackType}',`,
    "  trackId: 'my_track',",
    "  name: 'My track',",
    `  assemblyNames: ${assemblyNames},`,
    ...adapter,
    '}',
  ]
}

// An adapter's #example is authored as a bare adapter snapshot
// (`{ type: 'BamAdapter', uri: '...' }`). On the rendered page we want the full
// track configuration a user actually pastes, so wrap that snapshot's code
// fence as the `adapter:` value of a track config of the adapter's #trackType
// (defaulting to FeatureTrack). Prose around the fence is preserved; an example
// that already spells out a full config (declares trackId/adapter) is left
// alone. Final indentation is normalized by the oxfmt sweep in generate.ts.
function wrapAdapterExample(content: string, trackType = 'FeatureTrack') {
  return content.replace(
    /```(?:js|javascript|json)?\n([\s\S]*?)\n```/g,
    (full: string, inner: string) => {
      const code = inner.trim()
      const isBareAdapter = code.startsWith('{') && /\btype\s*:/.test(code)
      const alreadyFull = /\b(?:trackId|adapter)\s*:/.test(code)
      return isBareAdapter && !alreadyFull
        ? ['```js', ...trackConfigLines(trackType, code), '```'].join('\n')
        : full
    },
  )
}

// An adapter declares the track type its example is wrapped in via #trackType
// (see wrapAdapterExample). Surface the full chain the adapter's data flows
// through: the track that consumes it, then the display types that render that
// track — closing the loop with each display's "Adapter" line.
function usedInLines(trackType: string | undefined, links: DisplayLinkContext) {
  const track = trackType && links.byName.get(trackType)
  if (!trackType || !track) {
    return []
  }
  const displayLines = (links.displayTypesByTrack.get(trackType) ?? [])
    .map(name => links.byName.get(name))
    .filter((d): d is ConfigWithHeader => Boolean(d))
    .map(d => relatedLine('Display', `[${d.header.name}](../${d.header.id})`))
  return [
    relatedLine('Track', `[${track.header.name}](../${track.header.id})`),
    ...displayLines,
  ]
}

// The concrete configs that inherit this one's slots, for a base/shared schema
// that is never named in a config itself. Without it a reader arriving at
// `BaseLinearDisplay#slot-fetchsizelimit` has the slot's meaning but no type to
// set it on; these are the pages whose own example shows the shape.
function extendedByLines(name: string, links: DisplayLinkContext) {
  return (links.extendedBy.get(name) ?? [])
    .map(childName => links.byName.get(childName))
    .filter((c): c is ConfigWithHeader => Boolean(c))
    .map(c =>
      relatedLine('Extended by', `[${c.header.name}](../${c.header.id})`),
    )
}

// Whether a config is a base/shared schema — inherited from, never written in a
// config file itself. Positive evidence that a config IS writable: a
// DisplayType registration (ground truth, the same map that builds the display
// links), or an authored #example. Extended by others with neither is a base.
// This is what keeps `"type": "BaseLinearDisplay"` — the one string a reader
// arriving from a `#slot-` link would copy — out of the slot table.
function isBaseSchema(header: ConfigHeader, links: DisplayLinkContext) {
  return (
    links.extendedBy.has(header.name) &&
    !links.displayToTrackType.has(header.name) &&
    !header.examples.length
  )
}

// Which shorthand keys an adapter accepts in place of writing its location slot
// out, read from the manifest `jbrowse validate` checks against — the only place
// this is known, since a shorthand is whatever the adapter's snapshot normalizer
// chooses to rewrite and is found by probing it, not by reading a declaration.
// (`scripts/generateConfigManifest.ts`, which autogen runs before this.)
//
// Stated per adapter because the answer genuinely varies and the guides could
// only ever hedge at it: `uri` covers most adapters, 14 have no shorthand at
// all, and one page saying so beats a sentence in file_types.md that a reader
// has to take on faith.
const MANIFEST =
  'products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'

// Read on first use rather than at module scope. Importing this module is how
// generate.ts reaches `accumulateConfig`, and an eager read made the import
// itself throw when the manifest was absent — a failure attributed to whatever
// happened to be running, rather than to the generator that needs the file.
export interface ManifestSlot {
  name: string
  // MST's name for the slot type. `identifier` marks the trackId/displayId
  // family, which no page carries a row for.
  type: string
  subSlots?: ManifestSlot[]
}
interface ManifestEntry {
  slots: ManifestSlot[]
  shorthandKeys?: string[]
  // Displays only: the MST properties of the display's STATE model, which a
  // session snapshot sets and a track config cannot. Lets the example gate say
  // which wrong place a key is in rather than only that it is wrong.
  stateModelProps?: string[]
}
type ManifestCategories = Record<string, Record<string, ManifestEntry>>
export type TypedManifestEntry = ManifestEntry & { category: string }

// Categories whose objects an `#example` can be checked against
// (assertExampleKeysAreSlots).
//
// TEXT SEARCH adapters are the one type table left out: the manifest computes
// `shorthandKeys` only for `group === 'adapter'` (`generateConfigManifest`), so
// a text search adapter that does accept a shorthand records none —
// TrixTextSearchAdapter's `preProcessSnapshot` expands `uri` into its three file
// paths, and checking against its slot list alone reports that `uri` as unknown.
// A gate that rejects correct documentation is worse than a narrower one.
const EXAMPLE_CHECKED_CATEGORIES = new Set([
  'adapters',
  'connections',
  'tracks',
  'displays',
])

let manifestByType: Record<string, TypedManifestEntry> | undefined
let adapterShorthands: Record<string, ManifestEntry> | undefined

function readManifest() {
  if (!adapterShorthands) {
    const text = fs.readFileSync(MANIFEST, 'utf8')
    const json =
      /export const configManifest: ConfigManifest = (\{[\s\S]*\})\n/.exec(
        text,
      )?.[1]
    const parsed = json ? (JSON.parse(json) as ManifestCategories) : undefined
    if (!parsed?.adapters?.BamAdapter) {
      // A manifest this cannot read would silently mark every adapter as having
      // no shorthand, which reads as a fact rather than as a missing file.
      throw new Error(`could not read adapter shorthands from ${MANIFEST}`)
    }
    adapterShorthands = parsed.adapters
    // Every type table, each entry tagged with the category it came from — the
    // two gates that read this want different subsets, and a gate that widened
    // the table would otherwise silently widen the other one too.
    // `migratedDisplayKeys` is not a type table and is dropped by the shape
    // guard.
    manifestByType = Object.fromEntries(
      (
        [
          'adapters',
          'connections',
          'tracks',
          'displays',
          'textSearchAdapters',
        ] as const
      )
        .flatMap(category =>
          Object.entries(parsed[category] ?? {}).map(
            ([name, entry]) => [name, { ...entry, category }] as const,
          ),
        )
        .filter(([, entry]) => Array.isArray(entry.slots)),
    )
  }
  return { adapters: adapterShorthands, byType: manifestByType! }
}

function shorthandKeysByAdapter() {
  return readManifest().adapters
}

function configManifest() {
  return readManifest().byType
}

function shorthandLine(name: string, category: string, isBase: boolean) {
  if (category !== 'Adapter' || isBase) {
    return ''
  }
  const keys = shorthandKeysByAdapter()[name]?.shorthandKeys ?? []
  if (!keys.length) {
    return `This adapter has no \`uri\` [shorthand](${FILE_TYPES_GUIDE}#the-uri-shorthand) — give it the location slots below.`
  }
  return `It also accepts the [shorthand](${FILE_TYPES_GUIDE}#the-uri-shorthand) key${keys.length > 1 ? 's' : ''} ${keys.map(k => `\`${k}\``).join(', ')} in place of writing a location slot out.`
}

// Where a page's slots are written in a config file. A `#slot-` deep link
// scrolls past the example and lands mid-table, so the nesting — adapter slot,
// display entry, or top-level track field — has to be stated at the table
// itself; the reader who followed that link never sees anything above it.
function slotNesting(name: string, category: string, isBase: boolean) {
  if (isBase) {
    return `\`${name}\` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in its own example.`
  }
  const shapes: Record<string, string> = {
    Adapter: `These slots go inside the track's \`adapter\`: \`"adapter": { "type": "${name}", ... }\`.`,
    Display: `These slots go on a display entry: \`"displays": [{ "type": "${name}", ... }]\`, or in the track's [\`displayDefaults\`](${DISPLAYS_GUIDE}) when this is its default display.`,
    Track:
      'These slots are top-level fields of the track config, alongside `trackId` and `name`.',
    Connection:
      "These slots are top-level fields of the connection's entry in `connections`.",
    'Internet Account':
      "These slots are top-level fields of the account's entry in `internetAccounts`.",
  }
  return shapes[category] ?? ''
}

// The inverse of the per-display model link in displayTypesLines: a config
// (commonly a Display or Track) links to its own state-model page when one with
// the same name is documented, so the two halves of a pluggable element — config
// slots and runtime API — reference each other.
function stateModelLine(name: string, id: string, links: DisplayLinkContext) {
  return links.modelNames.has(name)
    ? relatedLine('State model', `[runtime API](../../models/${id})`)
    : ''
}

// Drop a leading paragraph that only restates the config's own name
// ("configuration schema for the LinearAlignmentsDisplay") — pure noise above the
// real overview. Anchored on the exact name, so it can never eat an authored
// description that happens to start similarly (e.g. "used to load bgzip-
// compressed, tabix-indexed VCF files" survives — it names no config).
function stripNameTautology(docs: string, name: string) {
  const esc = escapeRegExp(name)
  const re = new RegExp(
    `^\\s*(?:configuration(?: schema)? (?:for|of)(?: the)? ${esc}|${esc} configuration(?: schema)?)\\.?[^\\S\\n]*(?:\\n|$)`,
    'i',
  )
  return docs.replace(re, '').trim()
}

function renderConfig(
  {
    header,
    derives,
    identifier,
    preProcess,
    slots,
    filename,
  }: ConfigWithHeader,
  bases: ConfigWithHeader[],
  links: DisplayLinkContext,
): string {
  const directBase = bases[0]
  // Overview holds only conceptual prose. The pre-processor's simplified-config
  // snippet duplicates a hand-authored #example (same minimal `{ type, uri }`
  // shape), so it renders only as a fallback when no #example exists.
  const overviewParts = section(
    preProcess &&
      !header.examples.length &&
      section(
        `### ${header.name} - Pre-processor / simplified config`,
        preProcess.docs,
      ),
    identifier &&
      section(
        `### ${header.name} - Identifier`,
        // an `implicitIdentifier` auto-generates when omitted; only an
        // `explicitIdentifier` is a required caller-supplied field
        identifier.code.trimStart().startsWith('implicitIdentifier')
          ? `Every ${header.name} has a unique \`${identifierField(identifier)}\`, a top-level field (not one of the config slots below) that identifies it; it is auto-generated when omitted.`
          : `Every ${header.name} has a unique \`${identifierField(identifier)}\`, a required top-level field that identifies it (not one of the config slots below).`,
        identifier.docs,
      ),
  )

  // Slots are the primary configuration surface, so they get their own H2 —
  // visible in the page's table of contents (which indexes only h2/h3) — instead
  // of being buried under Overview. One table is the whole reference: a slot's
  // type, default, and prose are the entire content of a slot, and they fit a
  // row, so nothing is duplicated between a summary and a detail view and a
  // 50-slot display page stays 50 lines rather than 250.
  const category = configCategory(header.name, header.category)
  const isBase = isBaseSchema(header, links)
  const table = slotsTable(slots, bases)
  const slotsSection = table
    ? section(
        '## Config slots',
        [
          slotNesting(header.name, category, isBase),
          shorthandLine(header.name, category, isBase),
          `Slot types (\`fileLocation\`, \`frozen\`, ...) are explained in the [config slot types reference](${SLOT_TYPES_GUIDE}). Slots a base configuration contributes are listed here too, so this table is the whole surface.`,
        ]
          .filter(Boolean)
          .join(' '),
        table,
      )
    : ''

  // Every cross-reference to another documented page (adapter/track/display/
  // state-model/base-config links) is gathered here as one flat bullet list,
  // one link per line prefixed with what kind of page it is, instead of
  // scattered through Overview as its own subsection apiece — a reader
  // looking for "what connects to this config" has one place to scan.
  const derivesLine = derives
    ? // when the base resolves to a page, the link says it all; only fall back
      // to the raw `baseConfiguration:` code when it couldn't be resolved
      directBase
      ? relatedLine(
          'Base config',
          `[${directBase.header.name}](../${directBase.header.id})`,
        )
      : section(
          `**Base config:** (unresolved) ${derives.docs}`,
          codeBlock(derives.code),
        )
    : ''
  const relatedLines = [
    ...displayTypesLines(header.name, links),
    ...compatibleAdaptersLines(header.name, links),
    ...usedInLines(header.trackType, links),
    ...extendedByLines(header.name, links),
    stateModelLine(header.name, header.id, links),
    derivesLine,
  ].filter(Boolean)

  // Keyed on the rendered table, not on whether any slot exists: `slotsTable`
  // drops container sub-schema rows (see isContainerSlot), so a config whose
  // every slot is a container has slots and no table — and the note would point
  // at a "Config slots" section this page does not emit. No page hits that
  // today; the two were separate predicates for the same question, which is the
  // part worth removing.
  const slotsNote = table
    ? 'See the **Config slots** section below for all available configuration fields.'
    : ''
  // On adapter pages, show the full track config a user pastes, not just the
  // bare adapter snapshot the #example is authored as.
  const examples =
    category === 'Adapter'
      ? header.examples.map(ex => ({
          ...ex,
          content: wrapAdapterExample(ex.content, header.trackType),
        }))
      : header.examples
  const exSection = exampleSection(examples, '## Example usage', slotsNote)
  const docsSection = overviewSection(
    stripNameTautology(header.docs, header.name),
    overviewParts,
  )
  const relatedSection = relatedLines.length
    ? section('## Related links', relatedLines.join('\n'))
    : ''
  // #gotcha text renders as a caution callout directly under the example, where
  // someone copying that example will actually read it. Footguns documented at
  // the definition site can't drift out of a hand-written guide.
  const gotchaSection = header.gotchas
    .map(g => section(':::caution Gotcha', g, ':::'))
    .join('\n\n')

  // Lead with the pasteable example and a short overview, then point the reader
  // at where this config connects (Related links) before the slot reference —
  // navigation before the long tail of fields, not buried beneath it.
  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    notes: `Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts.`,
    sourcePath: filename,
    body: section(
      exSection,
      gotchaSection,
      docsSection,
      relatedSection,
      slotsSection,
    ),
  })
}

// The `#identifier` tag sits on the schema's `explicitIdentifier: '<field>'`
// option, so the extracted `name` is the literal property `explicitIdentifier`,
// not the field it points at. Pull the actual identifier field (e.g. `trackId`)
// out of the value — that field is stored at the top level of the snapshot and
// is not declared as a config slot.
function identifierField(identifier: Item) {
  return stripPropertyName(identifier.code)
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

interface SlotMeta {
  type?: string
  description?: string
  defaultValue?: string
  enumValues?: string[]
  advanced?: boolean
  // What a promotable slot resolves to when nothing overrides it — **and the
  // only marker that the slot is promotable at all** (`isPromotableSlot`).
  // There is no `promotable` flag any more, here or in `ConfigSlotDefinition`.
  //
  // The key is set-but-`undefined` for a slot whose override turns promotion
  // off, which is load-bearing: `resolveInheritedSlotMeta` layers a base and its
  // override with a spread, so a *present* `undefined` overwrites the inherited
  // value exactly as the runtime `mergeSchemaDefinition` spread does, while an
  // absent key would inherit it.
  promotedBase?: string
  // `contextVariable`: the names a jexl callback on this slot receives
  contextVariable?: string[]
  // source of a default too long to render inline (a long array/object
  // literal), shown in the Default column behind a fold
  defaultCode?: string
  // source of a `model` that isn't an enumeration we could read the values of,
  // shown in the Type column
  typeCode?: string
  // source of a slot whose value isn't a plain object literal at all
  // (`pluginManager.pluggableConfigSchemaType('adapter')`), which has no type or
  // default to name — it is the whole description of the slot
  valueCode?: string
}

// A slot's value is an object literal (`{ type, description, defaultValue, ... }`).
// Surface its fields as table columns rather than leaving a reader to parse them
// out of a dumped code block: the in-object `description` becomes the slot's
// prose when no JSDoc was written, and type/default/enum/flags become cells.
function parseSlotMeta(value: string): SlotMeta {
  const sf = ts.createSourceFile(
    'slot.ts',
    `const __x = ${value}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const decl = sf.statements.find(ts.isVariableStatement)
  const init = decl?.declarationList.declarations[0]?.initializer
  const meta: SlotMeta = {}
  if (init && ts.isObjectLiteralExpression(init)) {
    for (const p of init.properties) {
      // a shorthand/spread/computed property, or a key no column names, can't
      // be summarized — the whole source stands in for it
      if (
        !(
          ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.name) &&
          applySlotProperty(meta, p.name.text, p.initializer)
        )
      ) {
        meta.valueCode = value
      }
    }
  } else {
    meta.valueCode = value
  }
  return meta
}

// Fills in the column this slot property feeds; false when the key is one no
// column covers.
function applySlotProperty(
  meta: SlotMeta,
  key: string,
  node: ts.Expression,
): boolean {
  if (key === 'type' && ts.isStringLiteralLike(node)) {
    meta.type = node.text
  } else if (key === 'description' && ts.isStringLiteralLike(node)) {
    meta.description = node.text
  } else if (key === 'defaultValue') {
    const inline = renderInlineDefault(node)
    if (inline === undefined) {
      meta.defaultCode = node.getText()
    } else {
      meta.defaultValue = inline
    }
  } else if (key === 'model') {
    const values = enumerationValues(node)
    if (values) {
      meta.enumValues = values
    } else {
      meta.typeCode = node.getText()
    }
  } else if (
    key === 'advanced' &&
    (node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword)
  ) {
    // `false` is recorded, not just skipped: an override states it to turn a
    // base slot's flag off, and that has to win over the inherited `true`
    meta.advanced = node.kind === ts.SyntaxKind.TrueKeyword
  } else if (key === 'promotedBase') {
    if (ts.isIdentifier(node) && node.text === 'undefined') {
      // an override turning promotion off. Assign the key rather than leaving it
      // absent — see `SlotMeta.promotedBase`; `renderInlineDefault` would
      // otherwise hand back the *string* 'undefined', which reads as a promoted
      // base whose value happens to be spelled that way.
      meta.promotedBase = undefined
    } else {
      meta.promotedBase = renderInlineDefault(node) ?? node.getText()
    }
  } else if (key === 'contextVariable') {
    const names = ts.isArrayLiteralExpression(node)
      ? node.elements.filter(ts.isStringLiteralLike).map(e => e.text)
      : undefined
    if (
      names?.length ===
      (ts.isArrayLiteralExpression(node) ? node.elements.length : -1)
    ) {
      meta.contextVariable = names
    } else {
      return false
    }
  } else {
    return false
  }
  return true
}

// The values of a `types.enumeration('Name', ['a', 'b'])` model, so a stringEnum
// slot's choices show on the label line instead of only in the code block. A
// spread of a named constant (`[...HEIGHT_MODE_VALUES]`) resolves through the
// enum-constant index — schemas share those tables with the track menus, and a
// reader still needs the members.
function enumerationValues(node: ts.Expression): string[] | undefined {
  const arr = ts.isCallExpression(node)
    ? node.arguments.find(ts.isArrayLiteralExpression)
    : undefined
  const values = arr?.elements.flatMap(el =>
    ts.isStringLiteralLike(el)
      ? [el.text]
      : ts.isSpreadElement(el) && ts.isIdentifier(el.expression)
        ? (enumConstantValues(el.expression.text) ?? [])
        : [],
  )
  return values?.length ? values : undefined
}

// A default rendered compactly enough to sit on the label line: scalars,
// identifier/property references (defaultFilterFlags, Number.MIN_VALUE, null),
// and short object/array literals. Anything longer returns undefined so its
// shape stays legible in the code block instead.
const MAX_INLINE_DEFAULT = 72
function renderInlineDefault(node: ts.Expression): string | undefined {
  const isScalar =
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    ts.isIdentifier(node) ||
    ts.isPropertyAccessExpression(node) ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
  if (ts.isStringLiteralLike(node)) {
    return `'${node.text}'`
  }
  // A bare identifier that names a known string constant renders as its value —
  // a reader of `defaultValue: DEFAULT_HIC_COLOR_SCHEME` wants `'juicebox'`.
  // Unresolvable or ambiguous names keep printing the identifier, which is what
  // non-string references (defaultFilterFlags, Number.MIN_VALUE) still do.
  const scalarConst = ts.isIdentifier(node)
    ? scalarConstantValue(node.text)
    : undefined
  if (scalarConst !== undefined) {
    return `'${scalarConst}'`
  }
  // Same for a number, unquoted. `defaultValue: GROW_MAX_HEIGHT` is written that
  // way because the ceiling is one fact shared with the mixin that caps against
  // it, and the reader still wants `800`.
  const numericConst = ts.isIdentifier(node)
    ? numericConstantValue(node.text)
    : undefined
  if (numericConst !== undefined) {
    return numericConst
  }
  if (isScalar) {
    return node.getText()
  }
  if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
    const oneLine = node
      .getText()
      .replace(/\s+/g, ' ')
      .replace(/,(\s*[}\]])/g, '$1')
    return oneLine.length <= MAX_INLINE_DEFAULT ? oneLine : undefined
  }
  return undefined
}

// Slot-type names (`fileLocation`, `frozen`, ...) are opaque jargon on their
// own, so link each documented one to its explanation in the slot-types guide.
// Only types with a heading there are linked — CI checks these anchors resolve —
// anything else renders as plain code.
//
// A map rather than a set of names, because a section does not have to be named
// after one type: the four `maybe*` types share one, and while this derived the
// anchor from the type name it emitted `#maybeboolean` at a page whose heading
// had become `{#the-maybe-types}`, which is 13 dead anchors CI counted and no
// reader could have followed.
const SLOT_TYPES_GUIDE = '/docs/config_guides/slot_types'
const FILE_TYPES_GUIDE = '/docs/config_guides/file_types'
const DISPLAYS_GUIDE = '/docs/config_guides/tracks#configuring-displays'
const MAYBE_TYPES_ANCHOR = 'the-maybe-types'
const DOCUMENTED_SLOT_TYPES = new Map([
  ['string', 'string'],
  ['number', 'number'],
  ['integer', 'integer'],
  ['boolean', 'boolean'],
  // the four the guide's `maybe*` section actually names
  ['maybeNumber', MAYBE_TYPES_ANCHOR],
  ['maybeBoolean', MAYBE_TYPES_ANCHOR],
  ['maybeStringEnum', MAYBE_TYPES_ANCHOR],
  ['maybeFrozen', MAYBE_TYPES_ANCHOR],
  ['fileLocation', 'filelocation'],
  ['stringEnum', 'stringenum'],
  ['color', 'color'],
  ['frozen', 'frozen'],
  ['text', 'text'],
])
function typeLink(type: string) {
  const anchor = DOCUMENTED_SLOT_TYPES.get(type)
  return anchor ? `[\`${type}\`](${SLOT_TYPES_GUIDE}#${anchor})` : `\`${type}\``
}

// Effective meta for a slot that overrides one further up the
// `baseConfiguration` chain, filled in by `resolveInheritedSlotMeta`.
const inheritedSlotMeta = new WeakMap<Item, SlotMeta>()

/**
 * Fold each overriding slot's meta over the base slot it shadows, matching what
 * `ConfigurationSchema` does at runtime (`mergeSchemaDefinition`): a redeclared
 * slot merges field-by-field over the base's rather than replacing it.
 *
 * Without this the pages describe a slot by its override's source text alone, so
 * an override stating only what differs reads as though it dropped everything it
 * left out — `LinearManhattanDisplay`'s `scatterPointSize` would render as a
 * common slot when it is really `advanced`, and `LGVSyntenyDisplay`'s `colorBy`
 * as neither advanced nor promotable when it is both. The flags, the
 * advanced/common split, and the promotable-settings table in
 * `user_guides/display_defaults.md` all read through `slotMetaFor`, so resolving
 * it here fixes each of them at once.
 */
function resolveInheritedSlotMeta(
  configs: ConfigWithHeader[],
  index: ConfigIndex,
) {
  for (const config of configs) {
    const bases = collectBaseConfigs(config, index)
    for (const slot of config.slots) {
      // nearest base first, so a slot overridden twice down a chain layers in
      // the same order the runtime spread does
      const inherited = bases.flatMap(base =>
        base.slots.filter(s => s.name === slot.name),
      )
      if (inherited.length) {
        const merged = inherited
          .reverse()
          .reduce<SlotMeta>(
            (acc, base) => ({ ...acc, ...parseSlotMeta(rawSlotValue(base)) }),
            {},
          )
        inheritedSlotMeta.set(slot, {
          ...merged,
          ...parseSlotMeta(rawSlotValue(slot)),
        })
      }
    }
  }
}

function rawSlotValue(item: Item) {
  return stripPropertyName(item.code)
}

function slotMetaFor(item: Item) {
  const value = rawSlotValue(item)
  return { value, meta: inheritedSlotMeta.get(item) ?? parseSlotMeta(value) }
}

// A slot whose source stands in for its type strips what the other columns
// already carry: the `description` (printed verbatim in the Description cell)
// and the blank lines JSDoc stripping leaves behind. Spliced by source range
// rather than by regex so a description wrapped across lines (prettier does
// this routinely) is removed whole.
function trimSlotCode(value: string) {
  const sf = ts.createSourceFile(
    'slot.ts',
    `const __x = ${value}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const offset = 'const __x = '.length
  const init = sf.statements.find(ts.isVariableStatement)?.declarationList
    .declarations[0]?.initializer
  const description =
    init && ts.isObjectLiteralExpression(init)
      ? init.properties.find(
          p =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'description',
        )
      : undefined
  const stripped = description
    ? value.slice(0, description.getStart(sf) - offset) +
      value.slice(description.getEnd() - offset).replace(/^,/, '')
    : value
  return stripped.replace(/\n\s*\n+/g, '\n')
}

// The anchor other pages link a slot by (the promotable-settings table in
// `user_guides/display_defaults.md`), kept as an explicit `<span id>` on the
// row: lowercased, with any dots in a nested slot name (e.g.
// `index.indexType`) dropped rather than kept as separators. Every link to a
// slot goes through this, including the ones writePromotableSlotDocs emits —
// spelling the anchor out a second time there meant a dotted slot name would
// have linked somewhere that doesn't exist.
function slotAnchor(name: string) {
  return `slot-${name.toLowerCase().replace(/\./g, '')}`
}

// The Type cell: the slot's declared type, linked to the slot-types guide, with
// a stringEnum's choices after it. A slot whose value isn't a `{ type, ... }`
// object at all (`pluginManager.pluggableConfigSchemaType('adapter')`, a nested
// `ConfigurationSchema`) has no type to name, so its source stands in — that
// expression is the only thing there is to say about it.
function slotTypeCell(meta: SlotMeta) {
  const enums = meta.enumValues ? ` (${meta.enumValues.join(', ')})` : ''
  return meta.type
    ? `${typeLink(meta.type)}${enums}`
    : codeCell(
        meta.typeCode ?? (meta.valueCode && trimSlotCode(meta.valueCode)),
      )
}

// Declaring `promotedBase` is what makes a slot promotable — the one marker, in
// the docs generator as in `ConfigSlotDefinition`. Set-but-`undefined` means an
// override turned promotion off, so `in` is the test rather than a truthiness
// check on the value.
function isPromotableSlot(meta: SlotMeta) {
  return 'promotedBase' in meta && meta.promotedBase !== undefined
}

// The Default cell. A promotable slot's own default is a sentinel meaning
// "unset", so it renders as what it actually resolves to.
function slotDefaultCell(meta: SlotMeta) {
  const value =
    meta.defaultValue !== undefined ? meta.defaultValue : meta.defaultCode
  return [
    // a promotable slot's own default is a sentinel; the value it resolves to
    // is the one a reader is after
    codeCell(isPromotableSlot(meta) ? meta.promotedBase : value),
    isPromotableSlot(meta) && '_promotable_',
  ]
    .filter(Boolean)
    .join(' ')
}

// The Description cell: the slot's prose in full (paragraph breaks kept), then
// the facts that have no column of their own — the jexl callback's arguments,
// whether the slot is `advanced` (hidden behind "show advanced" in the UI), and
// any authored `#example`, folded so a snippet doesn't hold the row open.
function slotDescriptionCell(item: Item, meta: SlotMeta) {
  return [
    proseCell(item.docs || meta.description),
    meta.contextVariable?.length &&
      `_callback args:_ ${meta.contextVariable.map(v => `\`${v}\``).join(', ')}`,
    meta.advanced && '_advanced_',
    exampleCell(item.examples),
  ]
    .filter(Boolean)
    .join('<br>')
}

// A sub-schema slot (`index`, `labels`) is a container: its own row would carry
// no type, default, or description, and its children are listed as `index.*`
// rows of their own.
function isContainerSlot(item: Item, meta: SlotMeta, all: Item[]) {
  return (
    !meta.type &&
    !(item.docs || meta.description) &&
    all.some(s => s.name.startsWith(`${item.name}.`))
  )
}

// The header row introducing a base's run of inherited slots (see slotsTable).
// The count tells a reader how much of the table they can skip; `slot-group` is
// what the stylesheet hangs the row's shading off.
function slotGroupRow(from: string, count: number) {
  return `| <span class="slot-group">Inherited from ${from}</span> | <span class="slot-group-count">${count} ${count === 1 ? 'slot' : 'slots'}</span> |`
}

// Name, type and default share one cell — `name` over `string = 'foo'` — rather
// than taking a column each. They are short and read as one fact ("what this
// slot is"), while the description is the column that actually needs the width;
// as three columns they squeezed a paragraph of prose into a quarter of the
// table.
function slotRow(item: Item) {
  const { meta } = slotMetaFor(item)
  const type = slotTypeCell(meta)
  const dflt = slotDefaultCell(meta)
  const cells = [
    [
      `<span id="${slotAnchor(item.name)}">**${item.name}**</span>`,
      [type, dflt].filter(Boolean).join(' = '),
    ]
      .filter(Boolean)
      .join('<br>'),
    slotDescriptionCell(item, meta),
  ]
  return `| ${cells.join(' | ')} |`
}

// One entry per config that declares a `baseConfiguration` we couldn't link to a
// documented #config. Driven off the full config set rather than per-render-pass
// base chains, so each unresolved derivation is listed exactly once and always
// attributed to the config that actually declares it (not a page that inherits
// it transitively).
function unresolvedBases(configs: ConfigWithHeader[], index: ConfigIndex) {
  return configs
    .filter(config => config.derives && !resolveBase(config, index))
    .map(
      config =>
        `${config.header.name} (${config.derives!.code.replace(/\s+/g, ' ').trim()})`,
    )
}

// An adapter page wraps its #example in a full track config of its #trackType.
// Without the tag we fall back to FeatureTrack, which is wrong for e.g.
// alignments/variant/sequence adapters, so the page shows a config that would
// not work — list it so the author adds the tag.
function adaptersMissingTrackType(configs: ConfigWithHeader[]) {
  return configs
    .filter(config => {
      const isAdapter =
        configCategory(config.header.name, config.header.category) === 'Adapter'
      // only when an example would actually be wrapped: an author who wrote the
      // full track config by hand hits wrapAdapterExample's `alreadyFull` guard
      // and keeps their own `type`, so no default was applied and there is
      // nothing to flag (MotifListAdapter was caught on exactly this)
      const wouldWrap = config.header.examples.some(
        ex => wrapAdapterExample(ex.content) !== ex.content,
      )
      return isAdapter && wouldWrap && !config.header.trackType
    })
    .map(config => config.header.name)
}

// A slot with neither a JSDoc comment nor an in-object `description` renders a
// blank Description cell — a name and a type with no explanation, which reads
// as "this setting does nothing" rather than as a missing sentence.
//
// Container sub-schemas are exempt because `slotsTable` already hides their
// rows (see isContainerSlot): they carry no type, default or prose of their
// own, their children are listed as `index.*` rows, and describing one only
// surfaces a row whose Type cell is a dumped `ConfigurationSchema(...)`. Asking
// for a description there sends the next author hunting for a sentence that
// makes the page worse.
function slotsMissingDescription(configs: ConfigWithHeader[]) {
  return configs.flatMap(c =>
    c.slots
      .filter(s => {
        const { meta } = slotMetaFor(s)
        return (
          !(s.docs || meta.description) && !isContainerSlot(s, meta, c.slots)
        )
      })
      .map(s => ({ file: c.filename, name: `${c.header.name}.${s.name}` })),
  )
}

// Fatal, for the same reason an untagged `#slot` is (see assertNoUntaggedSlots).
// This spent a long time as a line in the committed coverage list, which cannot
// hold a count at zero: the command that reports a new gap is the same command
// that records it as accepted, so a slot only has to be committed undescribed
// once to stay that way. 99 of them accumulated that way across ~50 schemas
// before anyone counted, including both location slots of CramAdapter — the
// entire useful surface of that page. The count is zero now, and the fix is one
// sentence at a definition site the error names exactly, so it can be held
// there. Gaps with a real backlog (a missing #example) stay in the coverage
// list; this one graduates.
function assertNoBlankSlotDescriptions(gaps: { file: string; name: string }[]) {
  if (gaps.length) {
    const byFile = new Map<string, string[]>()
    for (const gap of gaps) {
      byFile.set(gap.file, [...(byFile.get(gap.file) ?? []), gap.name])
    }
    throw new Error(
      `${gaps.length} config slot(s) would render a blank Description cell. Write the prose as a JSDoc body under the slot's #slot tag — the generator prefers it over an in-object \`description\`, and unlike \`description\` a comment is not shipped in the plugin bundle (that field is the config editor's helper text, so use it only when someone editing the slot in the UI needs the hint):\n${[
        ...byFile,
      ]
        .map(([file, list]) => `  ${file}: ${list.join(', ')}`)
        .join('\n')}`,
    )
  }
}

export interface ExampleObject {
  // the `type` the object claims, when the manifest carries that type
  typeName: string
  entry: TypedManifestEntry
  keys: string[]
  // keys of this object's `displayDefaults` block, which route by the TRACK's
  // display types rather than by any one display's slots
  displayDefaultKeys?: string[]
}

// Every object literal an `#example` writes, paired with the manifest entry its
// own `type` names. Parsed rather than regexed because an example is JS, not
// JSON — unquoted keys, single quotes, nested objects whose keys must not be
// mistaken for the outer ones.
//
// Keyed on each object's own `type`, not on the page's. An example is written in
// whatever shape a reader can paste, so the object a page is ABOUT is rarely the
// outer one: a display's example is a whole track config carrying the display
// two levels down, a sequence adapter is shown inside its ReferenceSequenceTrack,
// an alias adapter inside the whole assembly. Checking only the page's own type
// left every display example unchecked, which is how three of them came to
// document a key JBrowse drops.
//
// The walk stops at a `frozen` slot. Its value passes through no
// ConfigurationSchema, so nothing inside it is a slot of anything and whatever
// reads it picks its own shape — MultiWiggleAdapter reads `name`/`group`/`color`
// off each `subadapters` entry, none of which the subadapter type declares.
export function exampleObjects(
  code: string,
  manifest: Record<string, TypedManifestEntry>,
) {
  const body = code.trim()
  // One example is a fragment naming its parent key (`sequence: {…}`), which is
  // not an expression. Braces make it an object whose outer level carries no
  // `type` and so is checked against nothing, while the object it holds is.
  const source = ts.createSourceFile(
    'example.ts',
    `const __example = ${body.startsWith('{') ? body : `{${body}}`}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const keyOf = (p: ts.ObjectLiteralElementLike) =>
    p.name?.getText().replaceAll(/['"]/g, '')
  const propNamed = (obj: ts.ObjectLiteralExpression, name: string) =>
    obj.properties.find(p => keyOf(p) === name)
  const out: ExampleObject[] = []

  const walkObject = (obj: ts.ObjectLiteralExpression) => {
    const type = propNamed(obj, 'type')
    const typeName =
      type &&
      ts.isPropertyAssignment(type) &&
      ts.isStringLiteralLike(type.initializer)
        ? type.initializer.text
        : undefined
    const entry = typeName ? manifest[typeName] : undefined
    const defaults = propNamed(obj, 'displayDefaults')
    if (entry) {
      out.push({
        typeName: typeName!,
        entry,
        keys: obj.properties.map(keyOf).filter((n): n is string => !!n),
        displayDefaultKeys:
          defaults &&
          ts.isPropertyAssignment(defaults) &&
          ts.isObjectLiteralExpression(defaults.initializer)
            ? defaults.initializer.properties
                .map(keyOf)
                .filter((n): n is string => !!n)
            : undefined,
      })
    }
    const frozen = new Set(
      (entry?.slots ?? [])
        .filter(s => s.type.includes('frozen'))
        .map(s => s.name),
    )
    for (const p of obj.properties) {
      const name = keyOf(p)
      if (ts.isPropertyAssignment(p) && !(name && frozen.has(name))) {
        descend(p.initializer)
      }
    }
  }
  const descend = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      walkObject(node)
    } else {
      ts.forEachChild(node, descend)
    }
  }
  descend(source)
  return out
}

// Every key an `#example` writes must be one the type declares, or a shorthand
// its snapshot normalizer rewrites.
//
// The examples are the most-copied config in the docs and were the one config
// surface with no checker: `check-config-blocks` validates the hand-written
// blocks in the guides and skips the generated pages precisely because these
// come from source — so "fixed in the source" was true and nothing checked the
// source. A key that is not a slot is the failure that matters, because JBrowse
// ignores an undeclared key rather than rejecting it: the example loads, does
// nothing, and reads as the documented way to do the thing.
//
// Keys come from the same manifest the shorthand line above reads, so a type
// the manifest does not carry (internet accounts, the root config schemas) is
// skipped rather than guessed at — checking against an empty slot list would
// report every key as unknown. The type tables checkable at all are
// EXAMPLE_CHECKED_CATEGORIES.
function assertExampleKeysAreSlots(
  configs: ConfigWithHeader[],
  displayTypesByTrack: Map<string, string[]>,
) {
  const manifest = configManifest()
  const checkable = Object.fromEntries(
    Object.entries(manifest).filter(([, entry]) =>
      EXAMPLE_CHECKED_CATEGORIES.has(entry.category),
    ),
  )
  const problems: string[] = []
  for (const config of configs) {
    for (const ex of config.header.examples) {
      const code = /```[\w]*\n([\s\S]*?)```/.exec(ex.content)?.[1]
      for (const obj of code ? exampleObjects(code, checkable) : []) {
        const unknown = unknownExampleKeys(obj, checkable, displayTypesByTrack)
        for (const [key, why] of unknown) {
          problems.push(
            `  ${config.filename}: ${config.header.name} #example writes \`${key}\` on its ${obj.typeName} — ${why}`,
          )
        }
      }
    }
  }
  if (problems.length) {
    throw new Error(
      `${problems.length} #example key(s) name something the type does not declare. JBrowse ignores an undeclared key, so such an example loads and silently does nothing — which is worse than no example. Fix the key, or add the slot:\n${problems.join('\n')}`,
    )
  }
}

// The keys of one example object that reach no slot, each with why — the two
// wrong places differ in what the reader should do, so the message does too.
export function unknownExampleKeys(
  obj: ExampleObject,
  manifest: Record<string, TypedManifestEntry>,
  displayTypesByTrack: Map<string, string[]>,
): [string, string][] {
  const known = new Set([
    ...obj.entry.slots.map(s => s.name),
    ...(obj.entry.shorthandKeys ?? []),
    // A track's per-display shorthand. Not a declared slot — the track config
    // schema's preProcessSnapshot folds it into `displays` — so the manifest
    // does not carry it, and it is the form the guides tell readers to write.
    ...(obj.entry.category === 'tracks' ? ['displayDefaults'] : []),
  ])
  const out = obj.keys
    .filter(k => !known.has(k))
    .map((key): [string, string] => [
      key,
      obj.entry.stateModelProps?.includes(key)
        ? 'a display state-model property, which a saved session sets and a track config drops'
        : 'not a slot it declares',
    ])
  // `displayDefaults` routes each setting to every display type of the track
  // that declares that slot (`collectDisplayOverrides`), so the union is the
  // rule — asking any one display would reject a key another display of the
  // same track owns. A key no display declares only warns at runtime, in a
  // console nobody is reading when they paste an example.
  const displaySlots = new Set(
    (displayTypesByTrack.get(obj.typeName) ?? []).flatMap(
      name => manifest[name]?.slots.map(s => s.name) ?? [],
    ),
  )
  out.push(
    ...(obj.displayDefaultKeys ?? [])
      .filter(k => !displaySlots.has(k))
      .map((key): [string, string] => [
        key,
        `in displayDefaults, and no display of a ${obj.typeName} declares it`,
      ]),
  )
  return out
}

// Every slot the live schema carries has to reach the type's page as a row.
//
// The repo enumerates config slots twice and nothing compared the two. This
// generator reads source ASTs and so can only see what a JSDoc tag points it
// at; `configManifest.generated.ts` instantiates the real ConfigurationSchema
// objects and reads their MST properties, which cannot miss a slot because the
// slot is on the object. Every gap between them is the docs' — and every one of
// them fails silently in the direction that reads as a fact: a page listing
// fewer settings than the type accepts looks like a type with fewer settings.
//
// A `baseConfiguration:` with no `#baseConfiguration` tag is the shape that
// motivated this. It drops the config's whole inherited chain, and the existing
// unresolved-base gap list cannot report it — that list holds bases that failed
// to RESOLVE, and an untagged one is never looked up at all.
//
// Three shapes are absent from a page by design, each exempt by a property of
// the manifest entry rather than by name:
//   - `type`, the discriminator. Not a setting anyone tunes, and `slotNesting`
//     plus every `#example` already show it in place.
//   - `identifier`-typed slots (trackId, displayId, connectionId,
//     textSearchAdapterId), which carry an `#identifier` tag rather than
//     `#slot` and render as the page's identity, not a row.
//   - a container sub-schema, whose own row `slotsTable` hides (isContainerSlot)
//     and whose children render as `index.*` rows.
function assertManifestSlotsAreDocumented(
  configs: ConfigWithHeader[],
  index: ConfigIndex,
) {
  const manifest = configManifest()
  const problems = configs.flatMap(cfg => {
    const entry = manifest[cfg.header.name]
    if (!entry) {
      return []
    }
    const documented = new Set(
      [cfg, ...collectBaseConfigs(cfg, index)].flatMap(c =>
        c.slots.map(s => s.name),
      ),
    )
    const missing = entry.slots.flatMap(slot =>
      missingSlotNames(slot, documented),
    )
    return missing.length
      ? [
          `  ${cfg.filename}: ${cfg.header.name} renders no row for ${missing
            .map(name => `\`${name}\``)
            .join(', ')}`,
        ]
      : []
  })
  if (problems.length) {
    throw new Error(
      `${problems.length} config page(s) leave out a slot the live schema carries. The commonest cause is a \`baseConfiguration:\` with no \`#baseConfiguration\` JSDoc tag above it, which drops every inherited slot from the page at once; otherwise the slot needs a \`#slot\` tag of its own:\n${problems.join('\n')}`,
    )
  }
}

// Which of one manifest slot's names the page owes a row for. A container is
// covered by its own row OR by every child, so a container documented as a
// single row (`formatDetails`, whose sub-schema has a page of its own) passes
// while one missing half its children names the halves it is missing.
export function missingSlotNames(slot: ManifestSlot, documented: Set<string>) {
  if (slot.name === 'type' || slot.type === 'identifier') {
    return []
  }
  if (slot.subSlots?.length) {
    const missing = slot.subSlots
      .map(child => `${slot.name}.${child.name}`)
      .filter(name => !documented.has(name))
    return documented.has(slot.name) ? [] : missing
  }
  return documented.has(slot.name) ? [] : [slot.name]
}

// Group every documented adapter by the track type it declares via #trackType,
// so a track/display page can list the adapters that supply it.
function adaptersByTrackType(configs: ConfigWithHeader[]) {
  const map = new Map<string, string[]>()
  for (const config of configs) {
    const trackType = config.header.trackType
    if (trackType) {
      map.set(trackType, [...(map.get(trackType) ?? []), config.header.name])
    }
  }
  return map
}

// The "which settings can be made the default for all tracks" table in
// user_guides/display_defaults.md, from the slots declaring `promotedBase`
// themselves — the user guide used to list them by hand, which drifts the moment
// a display promotes a slot. Rows are the display types users actually meet
// (those with a `new DisplayType(...)` registration), each with its effective
// promotable slots: declared on the display or inherited from a base, shadowing
// resolved the same way the config page's "Inherited config slots" section
// resolves it. An override counts as promotable when the slot it shadows is
// (LGVSyntenyDisplay's `colorBy`), matching the runtime merge; to opt a slot out,
// state `promotedBase: undefined`.
//
// The column says "session-wide default", not "pin", because this is a *schema*
// fact and the pin is a *menu* fact. A display that inherits a promotable slot
// but whose track menu never builds a row for it has no pin — nothing static can
// see that, so the header claims only what the flag proves. The known cases are
// recorded in agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md.
export function writePromotableSlotDocs(
  byFile: Record<string, Config>,
  displayToTrackType: Map<string, string>,
  { check = false } = {},
) {
  mergeSpreadSlots(byFile)
  const withHeader = withHeaders(byFile)
  const index: ConfigIndex = {
    byDeclId: mapByKey(withHeader, c => c.header.declId),
    byName: mapByKey(withHeader, c => c.header.name),
  }
  resolveInheritedSlotMeta(withHeader, index)
  const rows = withHeader
    .filter(cfg => displayToTrackType.has(cfg.header.name))
    .map(cfg => {
      const seen = new Set<string>()
      const slots = [cfg, ...collectBaseConfigs(cfg, index)]
        .flatMap(c => filterUnseenByName(seen, c.slots))
        .filter(slot => isPromotableSlot(slotMetaFor(slot).meta))
        .map(slot => slot.name)
        .sort((a, b) => a.localeCompare(b))
      return { cfg, slots }
    })
    .filter(({ slots }) => slots.length > 0)
    .sort((a, b) => a.cfg.header.name.localeCompare(b.cfg.header.name))
    .map(({ cfg, slots }) => {
      const page = `/docs/config/${cfg.header.id}`
      const trackType = displayToTrackType.get(cfg.header.name)!
      const links = slots.map(
        slot => `[\`${slot}\`](${page}/#${slotAnchor(slot)})`,
      )
      return `| ${trackType} | [](${page}) | ${links.join(', ')} |`
    })
  return rewriteMarkerBlock(
    'PROMOTABLE_SLOTS',
    markdownTable(
      ['Track type', 'Display', 'Settings with a session-wide default'],
      rows,
    ),
    { check },
  )
}

export function writeConfigDocs(
  byFile: Record<string, Config>,
  displayTypesByTrack: Map<string, string[]>,
  displayToTrackType: Map<string, string>,
  modelNames: Set<string>,
) {
  const dir = 'website/docs/config'
  fs.mkdirSync(dir, { recursive: true })
  mergeSpreadSlots(byFile)
  const withHeader = withHeaders(byFile)
  const byDeclId = mapByKey(withHeader, c => c.header.declId)
  const byName = mapByKey(withHeader, c => c.header.name)
  const index: ConfigIndex = { byDeclId, byName }
  resolveInheritedSlotMeta(withHeader, index)
  // All before the write loop, so a run that would emit a blank cell, drop a
  // slot, or write one page for two types fails without having rewritten
  // anything.
  assertNoBlankSlotDescriptions(slotsMissingDescription(withHeader))
  assertExampleKeysAreSlots(withHeader, displayTypesByTrack)
  assertManifestSlotsAreDocumented(withHeader, index)
  assertUniquePages(
    '#config',
    withHeader.map(c => ({
      name: c.header.name,
      slug: c.header.id,
      filename: c.filename,
    })),
  )
  const extendedBy = extendedByMap(withHeader, index)
  const links: DisplayLinkContext = {
    displayTypesByTrack,
    displayToTrackType,
    adaptersByTrack: adaptersByTrackType(withHeader),
    byName,
    modelNames,
    extendedBy,
  }
  for (const cfg of withHeader) {
    writeDoc(
      `${dir}/${cfg.header.name}.md`,
      renderConfig(cfg, collectBaseConfigs(cfg, index), links),
    )
  }
  // A base/shared schema is exempt from the #example gap: it is never named in
  // a config, so an example on it would teach a type nobody can write. Listing
  // them made the list a 40-name wall that read as noise, which is how ~17
  // genuinely pasteable adapters and displays stayed bare. Their route to a
  // usable shape is the Extended by links, not an example of their own.
  //
  // isBaseSchema, not a bare `extendedBy.has()`: a config that others derive
  // from but that *is* itself writable — it carries a DisplayType registration —
  // is a real gap, and exempting it would hide the one thing this list exists to
  // surface.
  return {
    ...headerGaps({
      items: withHeader,
      getName: c => c.header.name,
      hasExample: c => c.header.examples.length > 0,
      // Was a filter on `items`, which also dropped these from the General gap —
      // a base schema that fell out of every category is still a real gap, and
      // that one was silently unreportable. Zero either way today; see the
      // headerGaps comment.
      wantsExample: c => !isBaseSchema(c.header, links),
      isGeneralCategory: c =>
        configCategory(c.header.name, c.header.category) === 'General',
    }),
    unresolvedBase: unresolvedBases(withHeader, index),
    adapterNoTrackType: adaptersMissingTrackType(withHeader),
  }
}
