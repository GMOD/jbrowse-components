import fs from 'fs'

import slugify from 'slugify'
import * as ts from 'typescript'

import { enumConstantValues } from './enumConstants.ts'
import { writeFormatted } from './format.ts'
import {
  assertSingleHeader,
  codeBlock,
  collapsibleClosed,
  collectTransitive,
  docPage,
  exampleSection,
  filterUnseenByName,
  firstSentence,
  lookupByIdOrName,
  mapByKey,
  markdownTable,
  overviewSection,
  parseNode,
  repoRelative,
  section,
  stripPropertyName,
  suffixCategory,
  tableCell,
  warnHeaderGaps,
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
  filename: string
}
type ConfigWithHeader = Config & { header: ConfigHeader }
interface ConfigIndex {
  byDeclId: Map<string, ConfigWithHeader>
  byName: Map<string, ConfigWithHeader>
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

// Full slot detail for every inherited config, grouped by the base it comes
// from, so a config page is self-contained — a reader configuring this track
// sees every available slot (own + inherited) without chasing links.
//
// `ownSlots` seeds a seen-by-name set so a slot the config (or a closer base)
// redeclares is skipped at every farther base — otherwise an override (e.g.
// LGVSyntenyDisplay's `colorBy`, non-promotable with a `strand` default) still
// shows the shadowed base definition (promotable, `normal` default) in the
// "Inherited" section, which reads as a live alternative rather than
// superseded history.
function inheritedSlotsSection(ownSlots: Item[], bases: ConfigWithHeader[]) {
  const seen = new Set(ownSlots.map(s => s.name))
  const blocks = bases.flatMap(config => {
    const shown = filterUnseenByName(seen, config.slots)
    return shown.length
      ? [
          collapsibleClosed(
            `Inherited from ${config.header.name}`,
            // a markdown link inside <summary> renders literally, so the link to
            // the base config's own page leads the body instead
            `[${config.header.name} config →](../${config.header.id})`,
            ...shown.map(s => slotBlock(s)),
          ),
        ]
      : []
  })
  return blocks.length
    ? section(
        '## Inherited config slots',
        'Slots available on this config via its base configuration(s), shown in full so this page is self-contained. A slot redeclared by a more specific config is shown once, at its most specific definition.',
        ...blocks,
      )
    : ''
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
// alone. Final indentation is normalized by the prettier pass in generate.ts.
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
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  // of being buried under Overview. The scan table lists the common slots; the
  // `_advanced_` ones (rarely touched — maxHeight, fetchSizeLimit, ...) fold into
  // a collapsed table so a 45-row display page doesn't lead with them. The
  // collapsed block below holds the full per-slot detail every row links into.
  const advancedSlots = slots.filter(s => slotMetaFor(s).meta.advanced)
  const commonSlots = slots.filter(s => !slotMetaFor(s).meta.advanced)
  const slotsSection = slots.length
    ? section(
        '## Config slots',
        `Slot types (\`fileLocation\`, \`frozen\`, ...) are explained in the [config slot types reference](${SLOT_TYPES_GUIDE}).`,
        commonSlots.length && slotsTable(commonSlots),
        advancedSlots.length &&
          collapsibleClosed(
            `Advanced slots (${advancedSlots.length})`,
            slotsTable(advancedSlots),
          ),
        collapsibleClosed(
          `${header.name} - Slots`,
          ...slots.map(s => slotBlock(s)),
        ),
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
    stateModelLine(header.name, header.id, links),
    derivesLine,
  ].filter(Boolean)

  const hasSlots = slots.length > 0 || bases.some(b => b.slots.length > 0)
  const slotsNote = hasSlots
    ? 'See the **Config slots** section below for all available configuration fields.'
    : ''
  const category = configCategory(header.name, header.category)
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
      inheritedSlotsSection(slots, bases),
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
  promotable?: boolean
  // `promotedBase`: what a promotable slot resolves to when nothing overrides it
  promotedBase?: string
  // `contextVariable`: the names a jexl callback on this slot receives
  contextVariable?: string[]
  // true when the slot carries something the label line can't summarize (a
  // non-inline default, a non-enumeration `model`, an unrecognized key), so the
  // full source code block is kept below rather than dropped as redundant.
  keepCode?: boolean
}

// A slot's value is an object literal (`{ type, description, defaultValue, ... }`).
// Surface its fields as prose/labels rather than leaving a reader to parse them
// out of a dumped code block: the in-object `description` becomes the slot's
// prose when no JSDoc was written, and type/default/enum/flags render as a
// compact label line. The code block is dropped whenever the label line fully
// captures the slot (see keepCode), which is the common case.
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
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
        applySlotProperty(meta, p.name.text, p.initializer)
      } else {
        meta.keepCode = true
      }
    }
  } else {
    meta.keepCode = true
  }
  return meta
}

function applySlotProperty(meta: SlotMeta, key: string, node: ts.Expression) {
  if (key === 'type' && ts.isStringLiteralLike(node)) {
    meta.type = node.text
  } else if (key === 'description' && ts.isStringLiteralLike(node)) {
    meta.description = node.text
  } else if (key === 'defaultValue') {
    const inline = renderInlineDefault(node)
    if (inline === undefined) {
      meta.keepCode = true
    } else {
      meta.defaultValue = inline
    }
  } else if (key === 'model') {
    const values = enumerationValues(node)
    if (values) {
      meta.enumValues = values
    } else {
      meta.keepCode = true
    }
  } else if (
    (key === 'advanced' || key === 'promotable') &&
    node.kind === ts.SyntaxKind.TrueKeyword
  ) {
    meta[key] = true
  } else if (key === 'promotedBase') {
    const inline = renderInlineDefault(node)
    if (inline === undefined) {
      meta.keepCode = true
    } else {
      meta.promotedBase = inline
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
      meta.keepCode = true
    }
  } else {
    // an unrecognized key (contextVariable, a non-true flag, ...) can't be
    // summarized on the label line, so keep the source visible
    meta.keepCode = true
  }
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
// Only types with a matching `### <type>` heading there are linked — CI checks
// these anchors resolve — anything else renders as plain code.
const SLOT_TYPES_GUIDE = '/docs/config_guides/slot_types'
const DOCUMENTED_SLOT_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'maybeBoolean',
  'fileLocation',
  'stringEnum',
  'color',
  'frozen',
  'text',
])
function typeLink(type: string) {
  return DOCUMENTED_SLOT_TYPES.has(type)
    ? `[\`${type}\`](${SLOT_TYPES_GUIDE}#${type.toLowerCase()})`
    : `\`${type}\``
}

function slotMetaLine(meta: SlotMeta): string {
  const enums = meta.enumValues
    ? ` (one of ${meta.enumValues.map(v => `\`${v}\``).join(', ')})`
    : ''
  const flags = [meta.advanced && 'advanced', meta.promotable && 'promotable']
    .filter(Boolean)
    .join(', ')
  return [
    meta.type && `**Type:** ${typeLink(meta.type)}${enums}`,
    meta.defaultValue !== undefined && `**Default:** \`${meta.defaultValue}\``,
    // a promotable slot's default is a sentinel; the value it actually resolves
    // to is the one a reader is after
    meta.promotedBase !== undefined &&
      `**Resolves to:** \`${meta.promotedBase}\``,
    meta.contextVariable?.length &&
      `**Callback args:** ${meta.contextVariable.map(v => `\`${v}\``).join(', ')}`,
    flags && `_${flags}_`,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Parses a slot's value object literal once; slotBlock (full entry) and
// slotRow (table summary) both read off this so they can't drift apart.
function slotMetaFor(item: Item) {
  const value = stripPropertyName(item.code)
  return { value, meta: parseSlotMeta(value) }
}

// A retained source block exists to show the one thing the label line couldn't
// summarize, so strip what's already rendered above it: the `description`
// (printed verbatim as the slot's prose) and the blank lines JSDoc stripping
// leaves behind. Without this a kept block is mostly a second copy of the prose,
// which is what makes these pages read like source rather than reference.
// Spliced by source range rather than by regex so a description wrapped across
// lines (prettier does this routinely) is removed whole.
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

function slotBlock(item: Item) {
  const { value, meta } = slotMetaFor(item)
  return section(
    `#### slot: ${item.name}`,
    item.docs || meta.description,
    slotMetaLine(meta),
    meta.keepCode && codeBlock(trimSlotCode(value)),
    exampleSection(item.examples, '**Example:**'),
  )
}

// Mirrors the github-slugger id Astro derives for a slotBlock's `#### slot:
// <name>` heading: lowercased, with the `slot: ` prefix's punctuation and any
// dots in a nested slot name (e.g. `index.indexType`) dropped rather than
// kept as separators.
function slotAnchor(name: string) {
  return `slot-${name.toLowerCase().replace(/\./g, '')}`
}

// One row of the slots table: name (linked to its full entry below), type,
// and a one-line description.
function slotRow(item: Item) {
  const { meta } = slotMetaFor(item)
  const enums = meta.enumValues ? ` (${meta.enumValues.join(', ')})` : ''
  const type = meta.type ? `\`${meta.type}\`${enums}` : ''
  const desc = item.docs || meta.description
  return `| [${item.name}](#${slotAnchor(item.name)}) | ${tableCell(type)} | ${tableCell(desc && firstSentence(desc))} |`
}

// A real table of this config's own slots — name, type, and description at a
// glance — rather than a bare list of links, since the slots are the actual
// user-facing configuration surface and are worth seeing in one scan. The
// Slots section itself is collapsed by default (see renderConfig): this table
// is the primary way to find and evaluate a slot without opening it, and the
// site's own table of contents only goes down to h2/h3 so it misses the h4
// slot headings entirely.
function slotsTable(slots: Item[]) {
  return markdownTable(['Slot', 'Type', 'Description'], slots.map(slotRow))
}

// Warn once per config that declares a `baseConfiguration` we couldn't link to a
// documented #config. Driven off the full config set rather than per-render-pass
// base chains, so each unresolved derivation is reported exactly once and always
// attributed to the config that actually declares it (not a page that inherits
// it transitively).
function warnUnresolvedBases(configs: ConfigWithHeader[], index: ConfigIndex) {
  for (const config of configs) {
    if (config.derives && !resolveBase(config, index)) {
      const codeLine = config.derives.code.replace(/\s+/g, ' ').trim()
      console.warn(
        `${config.header.name}: baseConfiguration "${codeLine}" could not be resolved to a documented #config`,
      )
    }
  }
}

// An adapter page wraps its #example in a full track config of its #trackType.
// Without the tag we fall back to FeatureTrack, which is wrong for e.g.
// alignments/variant/sequence adapters — warn so the author adds the tag.
function warnAdaptersMissingTrackType(configs: ConfigWithHeader[]) {
  for (const config of configs) {
    const isAdapter =
      configCategory(config.header.name, config.header.category) === 'Adapter'
    if (
      isAdapter &&
      config.header.examples.length &&
      !config.header.trackType
    ) {
      console.warn(
        `${config.header.name}: adapter has an #example but no #trackType — its full-config example defaulted to FeatureTrack`,
      )
    }
  }
}

// A slot with neither a JSDoc comment nor an in-object `description` renders a
// blank Description cell — a name and a type with no explanation. Warn with the
// full `Config.slot` list so the gaps are an actionable to-do, mirroring the
// #example coverage warning.
function warnSlotsMissingDescription(configs: ConfigWithHeader[]) {
  const missing = configs.flatMap(c =>
    c.slots
      .filter(s => !(s.docs || slotMetaFor(s).meta.description))
      .map(s => `${c.header.name}.${s.name}`),
  )
  if (missing.length) {
    console.warn(
      `${missing.length} config slots have no description: ${missing.join(', ')}`,
    )
  }
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

export async function writeConfigDocs(
  byFile: Record<string, Config>,
  displayTypesByTrack: Map<string, string[]>,
  displayToTrackType: Map<string, string>,
  modelNames: Set<string>,
) {
  const dir = 'website/docs/config'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = withHeaders(byFile)
  const byDeclId = mapByKey(withHeader, c => c.header.declId)
  const byName = mapByKey(withHeader, c => c.header.name)
  const index: ConfigIndex = { byDeclId, byName }
  const links: DisplayLinkContext = {
    displayTypesByTrack,
    displayToTrackType,
    adaptersByTrack: adaptersByTrackType(withHeader),
    byName,
    modelNames,
  }
  warnUnresolvedBases(withHeader, index)
  warnAdaptersMissingTrackType(withHeader)
  warnSlotsMissingDescription(withHeader)
  for (const cfg of withHeader) {
    await writeFormatted(
      `${dir}/${cfg.header.name}.md`,
      renderConfig(cfg, collectBaseConfigs(cfg, index), links),
    )
  }
  warnHeaderGaps({
    items: withHeader,
    kind: 'configs',
    getName: c => c.header.name,
    hasExample: c => c.header.examples.length > 0,
    isGeneralCategory: c =>
      configCategory(c.header.name, c.header.category) === 'General',
  })
}
