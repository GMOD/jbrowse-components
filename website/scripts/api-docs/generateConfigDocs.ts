import slugify from 'slugify'
import * as ts from 'typescript'

import { escapeRegExp } from '../check-utils.ts'
import { colorChannelsSection, presetFieldsSection } from './colorChannels.ts'
import { looseTrackExample, wrapAdapterExample } from './configExamples.ts'
import {
  configManifest,
  liftsNumbers,
  manifestSlot,
  shorthandKeysByAdapter,
  writesLine,
} from './configManifest.ts'
import { parseNode } from './docProgram.ts'
import { slotSpreadPairs, slotSpreadPart } from './enumConstants.ts'
import { collectSlotTypes } from './generateSlotTypeDocs.ts'
import {
  codeBlock,
  codeCell,
  docPage,
  exampleCell,
  exampleSection,
  markdownTable,
  overviewSection,
  pageDescription,
  proseCell,
  section,
} from './markdown.ts'
import {
  inheritedSlotMeta,
  parseSlotMeta,
  rawSlotValue,
  slotMetaFor,
  slotSourceCode,
} from './slotSource.ts'
import {
  assertSingleHeader,
  collectTransitive,
  filterUnseenByName,
  lookupByIdOrName,
  mapByKey,
  repoRelative,
  stripPropertyName,
  suffixCategory,
  withHeaders,
} from './util.ts'

import type {
  Config,
  ConfigHeader,
  ConfigIndex,
  ConfigWithHeader,
  Item,
} from './configTypes.ts'
import type { ExtractedNode } from './docProgram.ts'
import type { Example } from './jsDocTags.ts'
import type { SlotMeta } from './slotSource.ts'

// Slots a schema pulls in by spreading a shared slot table
// (`...wiggleConfigSchemaFields`). They are real slots of this schema but carry
// no `#slot` JSDoc of their own — the table lives in a file with no `#config`, so
// tagging them there would bucket them under no config at all — which is why they
// were missing from the generated pages entirely. Recovered from the `#config`
// node's own source: every spread of a name the slot-table index knows (see
// enumConstants.ts) contributes its properties, in declaration order.
//
// A spread whose own JSDoc carries `#slot <name>` sections documents those
// slots in place instead (`emitSpreadSlots` in util.ts), and the declared
// name then wins below.
//
// **A spread inside a nested sub-schema keeps its parent's key**, so
// `index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields })` documents
// `index.indexType` rather than a top-level `indexType`. That is the same
// dotted name a `#slot index.indexType` JSDoc produces by hand, which is what
// nine tabix adapters wrote before the table was shared — without the prefix
// they would each have grown two slots at the wrong level, which reads as a
// schema change rather than as a docs bug.
//
// A schema's spread, a const or a factory call, reads the way a slot table's
// own does (`slotSpreadPart`), so the two never disagree on a shape.
function spreadPairs(expr: ts.Expression, sf: ts.SourceFile) {
  const part = slotSpreadPart(expr, sf)
  return part && slotSpreadPairs(part)
}

function spreadSlots(configNode: string): Item[] {
  const sf = ts.createSourceFile(
    'config.ts',
    configNode,
    ts.ScriptTarget.Latest,
    true,
  )
  const slots: Item[] = []
  const addPairs = (expr: ts.Expression, prefix: string) => {
    for (const [name, value] of spreadPairs(expr, sf) ?? []) {
      slots.push({
        name: `${prefix}${name}`,
        docs: '',
        examples: [],
        code: `${name}: ${value}`,
      })
    }
  }
  const visit = (node: ts.Node, prefix: string) => {
    if (ts.isSpreadAssignment(node)) {
      addPairs(node.expression, prefix)
    }
    // A property whose value is a nested `ConfigurationSchema(...)` opens a
    // level; anything else keeps the prefix it was reached with. A slot table
    // passed whole, `ConfigurationSchema('X', scaleSlots('Y'))`, is a spread of
    // that table.
    const schema =
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'ConfigurationSchema'
        ? { name: node.name.text, table: node.initializer.arguments[1] }
        : undefined
    const nested = schema ? `${prefix}${schema.name}.` : prefix
    if (schema?.table && !ts.isObjectLiteralExpression(schema.table)) {
      addPairs(schema.table, nested)
    }
    ts.forEachChild(node, child => {
      visit(child, nested)
    })
  }
  ts.forEachChild(sf, child => {
    visit(child, '')
  })
  return slots
}

// The first `ConfigurationSchema('Name', …)` in source order, the outermost
export function outerSchemaName(configNode: string) {
  const sf = ts.createSourceFile(
    'config.ts',
    configNode,
    ts.ScriptTarget.Latest,
    true,
  )
  const find = (node: ts.Node): string | undefined => {
    const [name] = ts.isCallExpression(node) ? node.arguments : []
    return ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'ConfigurationSchema' &&
      name &&
      ts.isStringLiteralLike(name)
      ? name.text
      : ts.forEachChild(node, find)
  }
  return find(sf)
}

// Fold each config's spread-in slots into its slot list, after accumulation so a
// `#slot` the schema declares itself always wins over the shared table's version
// of the same name. Idempotent, so both writers below can call it.
export function mergeSpreadSlots(byFile: Record<string, Config>) {
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
    // either way. `ConfigurationSchemaUnion(` documents its members, whose
    // `#slot` tags name them. A `normalizeSnapshot` body has none of the three,
    // which is the whole set of offenders.
    if (
      !obj.node.includes('ConfigurationSchema(') &&
      !obj.node.includes('ConfigurationSchemaUnion(') &&
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
      union: obj.node.includes('ConfigurationSchemaUnion('),
      schemaName: outerSchemaName(obj.node),
    }
    file.spreadSlots = spreadSlots(obj.node)
  } else if (obj.type === 'baseConfiguration') {
    file.derives = item
    file.baseDeclId = obj.baseDeclId
    file.baseConfigName = obj.baseConfigName
  } else if (obj.type === 'identifier') {
    file.identifier = item
  } else if (obj.type === 'slot') {
    const name = slotPathOf(obj, item.name)
    const seen = file.slots.find(s => s.name === name)
    if (!seen) {
      file.slots.push({
        ...item,
        name,
        schemaDeclIds: obj.valueDeclIds,
        schemas: obj.valueSchemas,
        returnedCode: obj.valueReturnedCode,
        parameterisedDefault: obj.parameterisedDefault,
      })
    } else if (seen.docs !== item.docs) {
      throw new Error(
        `${file.filename}: two \`#slot ${name}\` blocks with different text — the page would show only the first`,
      )
    }
  }
}

// A slot's row name: a tag spelling the slot alone (`#slot invalid`, or a bare
// `#slot`) inside a sub-schema names it by its path from the page's schema
// (`scale.invalid`), as a spread's rows are; a dotted tag is already a path.
function slotPathOf(obj: ExtractedNode, name: string) {
  return name.includes('.') ? name : `${obj.slotPrefix ?? ''}${name}`
}

// Resolve a config's documented base, or undefined: by declaration identity
// first, else by the config name recovered from a dynamic getDisplayType('Name')
// reference, and only when the config actually derives from something.
export function resolveBase(config: Config, index: ConfigIndex) {
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
export function collectBaseConfigs(
  config: ConfigWithHeader,
  index: ConfigIndex,
) {
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
// same LinearFeatureBaseDisplay link on 21 consecutive rows, spending a column's
// width to say once per row what one row can say for the run. The header also
// gives the run a boundary, so a reader who only wants this config's slots can
// stop at the first one.
//
// The seen-by-name set makes a slot the config (or a closer base) redeclares
// skip every farther base — otherwise an override (e.g. LGVSyntenyDisplay's
// `colorBy`, which moves the default to `strand`) also lists the shadowed base
// definition (`normal`), which reads as a live alternative rather than
// superseded history. The override's own row already carries the base's other
// fields, since `resolveInheritedSlotMeta` merges them the way the runtime does.
function slotsTable(name: string, ownSlots: Item[], bases: ConfigWithHeader[]) {
  const rows = pageSlotGroups(name, ownSlots, bases).flatMap(
    ({ from, records }) => [
      ...(from
        ? [
            slotGroupRow(
              `[${from.header.name}](../${from.header.id})`,
              records.length,
            ),
          ]
        : []),
      ...records.map(r => slotRecordRow(r)),
    ],
  )
  return markdownTable(['Slot', 'Description'], rows)
}

// The slots a page shows, as one record each, in the groups `slotsTable` heads:
// the config's own, then each base's that a closer one does not redeclare.
// Both renderers read these, so the website and the agent text cannot disagree
// on which slots a page has or what each one is.
export function pageSlotGroups(
  name: string,
  ownSlots: Item[],
  bases: ConfigWithHeader[],
) {
  const seen = new Set<string>()
  const groups = [
    { slots: filterUnseenByName(seen, ownSlots), from: undefined, name },
    ...bases.map(config => ({
      slots: filterUnseenByName(seen, config.slots),
      from: config,
      name: config.header.name,
    })),
  ]
  const all = groups.flatMap(g => g.slots)
  return groups
    .map(({ slots, from, name }) => ({
      from,
      records: slots
        .filter(s => !isContainerSlot(s, slotMetaFor(s).meta, all))
        .map(s => slotRecord(s, name)),
    }))
    .filter(g => g.records.length)
}

// Name-suffix heuristic for a config's sidebar category, checked in order.
const CONFIG_CATEGORIES: [string, string][] = [
  ['Adapter', 'Adapter'],
  ['Track', 'Track'],
  ['Display', 'Display'],
  ['Connection', 'Connection'],
  ['InternetAccount', 'Internet Account'],
]

export function configCategory(name: string, explicit?: string): string {
  return suffixCategory(name, explicit, CONFIG_CATEGORIES)
}

// A display-category schema that is neither a display, by registration or by
// naming its track, nor a base one extends is a value a display's slot holds
// (`AlignmentsColor`).
export function pageCategory(header: ConfigHeader, links: DisplayLinkContext) {
  const category = configCategory(header.name, header.category)
  return category === 'Display' &&
    !isBaseSchema(header, links) &&
    !links.displayToTrackType.has(header.name) &&
    configManifest()[header.name]?.category !== 'displays'
    ? 'Display setting'
    : category
}

// Everything renderConfig/displayTypesSection need to resolve a Track's
// "Display types" links: which Displays declare `trackType: 'ThisTrack'`
// (see DisplayTrackLink in util.ts), the config-doc index to turn a Display
// name into a page, and which Displays also have a documented state model.
// displayToTrackType/adaptersByTrack additionally link a display or track to the
// data adapters that feed it (see compatibleAdaptersSection).
export interface DisplayLinkContext {
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
export function extendedByMap(configs: ConfigWithHeader[], index: ConfigIndex) {
  const map = new Map<string, string[]>()
  for (const config of configs) {
    const base = resolveBase(config, index)
    if (base) {
      const name = base.header.name
      map.set(name, [...(map.get(name) ?? []), config.header.name])
    }
  }
  for (const names of map.values()) {
    names.sort((a, b) => a.localeCompare(b, 'en'))
  }
  return map
}

// The track type a config is associated with: a Track config is its own track
// type; a Display resolves through its DisplayType registration. Used to find
// the adapters that supply it.
export function relatedTrackType(name: string, links: DisplayLinkContext) {
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
export function isBaseSchema(header: ConfigHeader, links: DisplayLinkContext) {
  return (
    links.extendedBy.has(header.name) &&
    !links.displayToTrackType.has(header.name) &&
    !header.examples.length
  )
}

function shorthandLine(name: string, category: string, isBase: boolean) {
  if (category !== 'Adapter' || isBase) {
    return ''
  }
  const keys = shorthandKeysByAdapter()[name]?.shorthandKeys ?? []
  if (!keys.length) {
    return `\`${name}\` has no \`uri\` [shorthand](${FILE_TYPES_GUIDE}#the-uri-shorthand) — give it the location slots below.`
  }
  return `It also accepts the [shorthand](${FILE_TYPES_GUIDE}#the-uri-shorthand) key${keys.length > 1 ? 's' : ''} ${keys.map(k => `\`${k}\``).join(', ')} in place of writing a location slot out.`
}

// How a union's rows are written: `bin.step` is `{ "type": "bin", "step": … }`.
export function unionNesting(name: string, slots: Item[]) {
  const [type = 'type', slot = 'slot'] = slots[0]?.name.split('.') ?? []
  return `A ${name} is one of the types its rows begin with, named by its \`type\`, and takes only that type's rows: \`${type}.${slot}\` is written \`{ "type": "${type}", "${slot}": ... }\`, and a key belonging to another type is refused where the config is read.`
}

// Where a page's slots are written in a config file. A `#slot-` deep link
// scrolls past the example and lands mid-table, so the nesting — adapter slot,
// display entry, or top-level track field — has to be stated at the table
// itself; the reader who followed that link never sees anything above it.
// The manifest table a sidebar category's types are registered in. A sub-schema
// the sidebar files under a category (`RibbonColor` under Display, `BamIndex`
// under Adapter) is in none of them, and is not a `type` a config can name.
const REGISTERED_AS: Record<string, string> = {
  Adapter: 'adapters',
  Display: 'displays',
  Track: 'tracks',
  Connection: 'connections',
}

// `displayToTrackType` covers a display the manifest does not bundle, such as
// an example plugin's.
export function isNamedType(
  name: string,
  category: string,
  links: DisplayLinkContext,
) {
  const table = REGISTERED_AS[category]
  return (
    table === undefined ||
    configManifest()[name]?.category === table ||
    links.displayToTrackType.has(name)
  )
}

function slotNesting(
  name: string,
  category: string,
  isBase: boolean,
  links: DisplayLinkContext,
) {
  if (isBase) {
    return `\`${name}\` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in an example.`
  }
  if (!isNamedType(name, category, links)) {
    return ''
  }
  const shapes: Record<string, string> = {
    Adapter: `Adapter slots go inside the track's \`adapter\`: \`"adapter": { "type": "${name}", ... }\`.`,
    Display: `Display slots go on a display entry: \`"displays": [{ "type": "${name}", ... }]\`, or in the track's [\`displayDefaults\`](${DISPLAYS_GUIDE}) when this is its default display.`,
    Track:
      'Track slots are top-level fields of the track config, alongside `trackId` and `name`.',
    Connection:
      "Connection slots are top-level fields of the connection's entry in `connections`.",
    'Internet Account':
      "Account slots are top-level fields of the account's entry in `internetAccounts`.",
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
export function stripNameTautology(docs: string, name: string) {
  const esc = escapeRegExp(name)
  const re = new RegExp(
    `^\\s*(?:configuration(?: schema)? (?:for|of)(?: the)? ${esc}|${esc} configuration(?: schema)?)\\.?[^\\S\\n]*(?:\\n|$)`,
    'i',
  )
  return docs.replace(re, '').trim()
}

export function renderConfig(
  { header, derives, identifier, slots, filename }: ConfigWithHeader,
  bases: ConfigWithHeader[],
  links: DisplayLinkContext,
): string {
  const directBase = bases[0]
  // Overview holds only conceptual prose
  const overviewParts = section(
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
  const category = pageCategory(header, links)
  const isBase = isBaseSchema(header, links)
  const table = slotsTable(header.name, slots, bases)
  const slotsSection = table
    ? section(
        '## Config slots',
        [
          header.union
            ? unionNesting(header.name, slots)
            : slotNesting(header.name, category, isBase, links),
          shorthandLine(header.name, category, isBase),
          writesLine(header.name),
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

  // On adapter pages, show the full track config a user pastes, not just the
  // bare adapter snapshot the #example is authored as. Then, on the first
  // example either kind of page shows that the file name alone reaches, the
  // same track written loose — once per page, since the note reads the same
  // under every example that qualifies.
  let loosened = false
  const examples =
    category === 'Adapter' || category === 'Track'
      ? header.examples.map(ex => {
          // a text search adapter sits in aggregateTextSearchAdapters or a
          // track's textSearching, never in a track's `adapter`
          const content =
            category === 'Adapter' && header.trackType !== 'TextSearchAdapter'
              ? wrapAdapterExample(ex.content, header.trackType)
              : ex.content
          const loose = loosened ? '' : looseTrackExample(content)
          loosened ||= Boolean(loose)
          return { ...ex, content: section(content, loose) }
        })
      : header.examples
  const exSection = exampleSection(examples)
  const lead = stripNameTautology(header.docs, header.name)
  const docsSection = overviewSection(overviewParts)
  const relatedSection = relatedLines.length
    ? section('## Related links', relatedLines.join('\n'))
    : ''
  const retiredSection = retiredKeysSection(header.name)
  // #gotcha text renders as a caution callout directly under the example, where
  // someone copying that example will actually read it. Footguns documented at
  // the definition site can't drift out of a hand-written guide.
  const gotchaSection = header.gotchas
    .map(g => section(':::caution Gotcha', g, ':::'))
    .join('\n\n')

  // Open with what the type is, then the pasteable example, then where this
  // config connects (Related links) before the slot reference.
  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    description: pageDescription(
      stripNameTautology(header.docs, header.name),
      `Configuration slots of ${header.name}.`,
    ),
    notes: `Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts.`,
    sourcePath: filename,
    body: section(
      lead,
      exSection,
      gotchaSection,
      docsSection,
      relatedSection,
      presetFieldsSection(header.name),
      colorChannelsSection(header.name),
      slotsSection,
      retiredSection,
    ),
  })
}

// Keys an older config wrote that this schema still accepts, from the manifest
// `jbrowse validate` reads: each one either moves into a current slot on load
// or is read by nothing.
function retiredKeysSection(name: string) {
  const { legacyKeys = [], droppedKeys = [] } = configManifest()[name] ?? {}
  const dropped = new Set(droppedKeys)
  return legacyKeys.length
    ? section(
        '## Retired keys',
        'An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.',
        markdownTable(
          ['Key', 'On load'],
          legacyKeys.map(
            key =>
              `| \`${key}\` | ${dropped.has(key) ? 'ignored' : 'moved into a current slot'} |`,
          ),
        ),
      )
    : ''
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
const DOCUMENTED_SLOT_TYPES = new Map(
  collectSlotTypes().map(({ name }) => [
    name,
    name.startsWith('maybe') ? MAYBE_TYPES_ANCHOR : name.toLowerCase(),
  ]),
)
function typeLink(type: string) {
  const anchor = DOCUMENTED_SLOT_TYPES.get(type)
  return anchor ? `[\`${type}\`](${SLOT_TYPES_GUIDE}#${anchor})` : `\`${type}\``
}

/**
 * Fold each overriding slot's meta over the base slot it shadows, matching what
 * `ConfigurationSchema` does at runtime (`mergeSchemaDefinition`): a redeclared
 * slot merges field-by-field over the base's rather than replacing it.
 *
 * Without this the pages describe a slot by its override's source text alone, so
 * an override stating only what differs reads as though it dropped everything it
 * left out — `LinearManhattanDisplay`'s `size` would render as a
 * common slot when it is really `advanced`. The flags and the advanced/common
 * split both read through `slotMetaFor`, so resolving it here fixes each of them
 * at once.
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

// The anchor other pages link a slot by, kept as an explicit `<span id>` on the
// row: lowercased, with any dots in a nested slot name (e.g. `index.indexType`)
// dropped rather than kept as separators.
function slotAnchor(name: string) {
  return `slot-${name.toLowerCase().replace(/\./g, '')}`
}

function enumList(values: readonly string[]) {
  return values.map(v => (v === '' ? '""' : v)).join(', ')
}

// A slot holding another pluggable element's config, which its source spells
// `pluginManager.pluggableConfigSchemaType('display')`, maybe inside
// `types.array(...)`. Named by the config index section listing that kind.
const PLUGGABLE_SLOT =
  /^(types\.array\(\s*)?pluginManager\.pluggableConfigSchemaType\('([^']+)'\),?\s*\)?$/
const PLUGGABLE_INDEX_SECTION: Record<string, string> = {
  adapter: 'adapter',
  'text search adapter': 'adapter',
  display: 'display',
  track: 'track',
  connection: 'connection',
  'internet account': 'internet-account',
}

// `types.array(types.union(...pluginManager.getDisplayElements().map(…)))`,
// a track's list of every registered display's config.
const DISPLAY_ELEMENTS_SLOT =
  /^types\.array\(\s*types\.union\(\s*\.\.\.pluginManager\s*\.getDisplayElements\(\)/

function pluggableSlotType(code: string | undefined) {
  const trimmed = code?.trim() ?? ''
  const [, array, kind] = DISPLAY_ELEMENTS_SLOT.test(trimmed)
    ? [trimmed, 'list', 'display']
    : (PLUGGABLE_SLOT.exec(trimmed) ?? [])
  return kind
    ? {
        name: array ? `list of ${kind} configs` : `${kind} config`,
        section: PLUGGABLE_INDEX_SECTION[kind],
      }
    : undefined
}

// `pluginManager.getTrackType('ReferenceSequenceTrack').configSchema`: a slot
// holding one named element's config, which has a page of its own.
const NAMED_ELEMENT_SLOT =
  /^pluginManager\s*\.get(?:Track|Display|Adapter|Connection|InternetAccount)Type\(\s*'([^']+)'\s*\)!?\s*\.configSchema$/

// What a slot whose value isn't a `{ type, ... }` object holds, named and
// linked: a schema with a page of its own, another element's config, or a
// sub-schema whose slots are rows of this page or another. Undefined leaves
// the source to stand in.
function slotKind(item: Item, code: string | undefined) {
  const pluggable =
    pluggableSlotType(code) ?? pluggableSlotType(item.returnedCode)
  if (item.schemaPage) {
    return { name: item.schemaPage.name, href: `../${item.schemaPage.id}` }
  } else if (pluggable) {
    return {
      name: pluggable.name,
      href: pluggable.section && `/docs/config#${pluggable.section}`,
    }
  } else if (item.subSchema) {
    const { name, list, firstSlot, page } = item.subSchema
    return {
      name: list
        ? `list of ${name ?? 'sub-schema'} entries`
        : `${name ?? ''} sub-schema`.trim(),
      href: `${page ? `../${page}` : ''}#${slotAnchor(firstSlot)}`,
    }
  }
  return undefined
}

// What a slot holds: its declared type, with a stringEnum's choices, else what
// `slotKind` names, else a sub-schema named by its own name, else the source.
type SlotType =
  | { declared: string; enumValues?: readonly string[] }
  | { kind: string; href?: string }
  | { code: string | undefined }

// One slot as both renderers show it.
export interface SlotRecord {
  name: string
  type: SlotType
  liftsNumbers: boolean
  // a default the factory takes as a parameter has no one value to print, and
  // its parameter name is not a name the reader has; the prose carries what
  // each display passes
  default: { perDisplay: true } | { code: string | undefined }
  docs: string
  contextVariable: string[]
  advanced: boolean
  examples: Example[]
}

const PARAMETERISED_DEFAULT = 'per display'

function slotTypeOf(item: Item, meta: SlotMeta): SlotType {
  const code = slotSourceCode(meta)
  const kind = slotKind(item, code)
  const schemaName =
    code && /^ConfigurationSchema\(\s*'([^']+)'/.exec(code)?.[1]
  return meta.type
    ? { declared: meta.type, enumValues: meta.enumValues }
    : kind
      ? { kind: kind.name, href: kind.href }
      : schemaName
        ? { kind: `${schemaName} sub-schema` }
        : { code }
}

export function slotRecord(item: Item, schema: string): SlotRecord {
  const { meta } = slotMetaFor(item)
  return {
    name: item.name,
    type: slotTypeOf(item, meta),
    liftsNumbers: liftsNumbers(schema, item.name),
    default: item.parameterisedDefault
      ? { perDisplay: true }
      : {
          code:
            meta.defaultValue !== undefined
              ? meta.defaultValue
              : meta.defaultCode,
        },
    docs: item.docs || (meta.description ?? ''),
    contextVariable: meta.contextVariable ?? [],
    advanced: !!meta.advanced,
    examples: item.examples,
  }
}

// The record's type and default as text, each renderer supplying how a
// declared type, a link and a code span are spelled
export function slotTypeText(
  record: SlotRecord,
  spell: {
    declared: (type: string) => string
    kind: (name: string, href?: string) => string
    code: (code: string | undefined) => string
  },
) {
  const { type } = record
  const text =
    'declared' in type
      ? `${spell.declared(type.declared)}${type.enumValues ? ` (${enumList(type.enumValues)})` : ''}`
      : 'kind' in type
        ? spell.kind(type.kind, type.href)
        : spell.code(type.code)
  const dflt =
    'perDisplay' in record.default
      ? PARAMETERISED_DEFAULT
      : spell.code(record.default.code)
  return [`${text}${record.liftsNumbers ? ' of strings or numbers' : ''}`, dflt]
    .filter(Boolean)
    .join(' = ')
}

// A sub-schema slot (`index`, `labels`) is a container: its own row would carry
// no type, default, or description, and its children are listed as `index.*`
// rows of their own.
export function isContainerSlot(item: Item, meta: SlotMeta, all: Item[]) {
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
//
// The Description cell is the prose in full (paragraph breaks kept), then the
// facts that have no column of their own — the jexl callback's arguments,
// whether the slot is `advanced` (hidden behind "show advanced" in the UI), and
// any authored `#example`, folded so a snippet doesn't hold the row open.
function slotRecordRow(record: SlotRecord) {
  const type = slotTypeText(record, {
    declared: typeLink,
    kind: (name, href) => (href ? `[${name}](${href})` : name),
    code: code => codeCell(code),
  })
  const cells = [
    [`<span id="${slotAnchor(record.name)}">**${record.name}**</span>`, type]
      .filter(Boolean)
      .join('<br>'),
    [
      proseCell(record.docs),
      record.contextVariable.length &&
        `_callback args:_ ${record.contextVariable.map(v => `\`${v}\``).join(', ')}`,
      record.advanced && '_advanced_',
      exampleCell(record.examples),
    ]
      .filter(Boolean)
      .join('<br>'),
  ]
  return `| ${cells.join(' | ')} |`
}

export function slotRow(item: Item, schema: string) {
  return slotRecordRow(slotRecord(item, schema))
}

export function linkedConfigs(byFile: Record<string, Config>) {
  mergeSpreadSlots(byFile)
  const withHeader = withHeaders(byFile)
  const index: ConfigIndex = {
    byDeclId: mapByKey(withHeader, c => c.header.declId),
    byName: mapByKey(withHeader, c => c.header.name),
  }
  resolveInheritedSlotMeta(withHeader, index)
  linkSlotSchemas(withHeader, index)
  return { withHeader, index }
}

// Each sub-schema slot's link: the `#config` page its value names, else the
// rows of its schema on this page, own or inherited, else the page whose own
// rows document a schema its value reaches, the first by name where several
// do, since the configs arrive in program order.
function linkSlotSchemas(configs: ConfigWithHeader[], index: ConfigIndex) {
  const documented = new Map<
    string,
    { name: string; page: string; firstSlot: string }
  >()
  for (const config of configs) {
    const { header, slots } = config
    const pageSlots = [
      ...slots,
      ...collectBaseConfigs(config, index).flatMap(base => base.slots),
    ]
    for (const slot of slots) {
      const code = slotSourceCode(slotMetaFor(slot).meta)?.trim() ?? ''
      const elementName = NAMED_ELEMENT_SLOT.exec(code)?.[1]
      const schema =
        slot.schemaDeclIds?.map(id => index.byDeclId.get(id)).find(Boolean) ??
        (elementName ? index.byName.get(elementName) : undefined)
      if (schema) {
        slot.schemaPage = { name: schema.header.name, id: schema.header.id }
      }
      const first = pageSlots.find(
        s =>
          s.name.startsWith(`${slot.name}.`) &&
          !isContainerSlot(s, slotMetaFor(s).meta, pageSlots),
      )
      if (first) {
        const declared = manifestSlot(header.name, slot.name)
        const reached = slot.schemas?.[0]
        slot.subSchema = {
          name:
            declared?.schema ??
            /^(?:types\.array\(\s*)?ConfigurationSchema\(\s*'([^']+)'/.exec(
              code,
            )?.[1] ??
            reached?.name,
          list: declared
            ? declared.type.endsWith('[]')
            : code.startsWith('types.array(') || !!reached?.list,
          firstSlot: first.name,
        }
        const { name } = slot.subSchema
        const prior = name ? documented.get(name) : undefined
        if (
          name &&
          slots.includes(first) &&
          !(prior && prior.name.localeCompare(header.name, 'en') <= 0)
        ) {
          documented.set(name, {
            name: header.name,
            page: header.id,
            firstSlot: first.name,
          })
        }
      }
    }
  }
  for (const { header, slots } of configs) {
    for (const slot of slots.filter(s => !s.schemaPage && !s.subSchema)) {
      const reached = slot.schemas?.find(s => documented.has(s.name))
      const rows = reached && documented.get(reached.name)
      if (reached && rows) {
        slot.subSchema = {
          name: reached.name,
          list: reached.list,
          firstSlot: rows.firstSlot,
          page: rows.page === header.id ? undefined : rows.page,
        }
      }
    }
  }
}
