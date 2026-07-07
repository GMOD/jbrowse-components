import fs from 'fs'

import slugify from 'slugify'
import * as ts from 'typescript'

import {
  codeBlock,
  collapsible,
  collectTransitive,
  docPage,
  exampleSection,
  filterUnseenByName,
  lookupByIdOrName,
  mapByKey,
  overviewSection,
  parseNode,
  repoRelative,
  section,
  stripPropertyName,
  suffixCategory,
  assertSingleHeader,
  warnHeaderGaps,
  withHeaders,
} from './util.ts'
import { writeFormatted } from './format.ts'

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
          collapsible(
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

// The data adapters that feed a track/display, each declared via an adapter's
// `#trackType` tag. Gives e.g. LinearAlignmentsDisplay -> BamAdapter,
// CramAdapter, and AlignmentsTrack -> the same — so a reader configuring the
// display or track sees which data formats it accepts.
function compatibleAdaptersSection(name: string, links: DisplayLinkContext) {
  const trackType = relatedTrackType(name, links)
  const track = trackType ? links.byName.get(trackType) : undefined
  const lines = (trackType ? (links.adaptersByTrack.get(trackType) ?? []) : [])
    .map(adapterName => links.byName.get(adapterName))
    .filter((a): a is ConfigWithHeader => Boolean(a))
    .map(a => `- [${a.header.name}](../${a.header.id})`)
  // on a Track's own page the track type is this page, so don't self-link
  const trackLabel =
    name === trackType
      ? 'this track'
      : track
        ? `the [${trackType}](../${track.header.id})`
        : `the ${trackType ?? 'track'}`
  return lines.length
    ? section(
        `### ${name} - Compatible adapters`,
        `Data adapters that can supply ${trackLabel}:`,
        lines.join('\n'),
      )
    : ''
}

// Reverse-links a Track config to the Display types that attach to it.
// Displays parameterized from a shared factory at runtime (e.g.
// LDDisplay/LDTrackDisplay) carry no individually-tagged #config and so
// resolve to nothing here; silently skipped, same as an empty Slots section.
function displayTypesSection(name: string, links: DisplayLinkContext) {
  const lines = (links.displayTypesByTrack.get(name) ?? []).flatMap(
    displayName => {
      const display = links.byName.get(displayName)
      if (!display) {
        return []
      }
      const modelLink = links.modelNames.has(displayName)
        ? ` ([state model](../../models/${display.header.id}))`
        : ''
      return [`- [${displayName}](../${display.header.id})${modelLink}`]
    },
  )
  return lines.length
    ? section(
        `### ${name} - Display types`,
        'A track is just a container; the actual rendering behavior and config slots live on its display type(s):',
        lines.join('\n'),
      )
    : ''
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
// track — closing the loop with each display's "Compatible adapters" section.
function usedInSection(
  trackType: string | undefined,
  links: DisplayLinkContext,
) {
  const track = trackType ? links.byName.get(trackType) : undefined
  const displayLines = (
    trackType ? (links.displayTypesByTrack.get(trackType) ?? []) : []
  )
    .map(name => links.byName.get(name))
    .filter((d): d is ConfigWithHeader => Boolean(d))
    .map(d => `- [${d.header.name}](../${d.header.id})`)
  return track
    ? section(
        '### Used in',
        displayLines.length
          ? `Supplies data to the [${track.header.name}](../${track.header.id}) track, rendered by:`
          : `Supplies data to the [${track.header.name}](../${track.header.id}) track.`,
        displayLines.join('\n'),
      )
    : ''
}

// The inverse of the per-display model link in displayTypesSection: a config
// (commonly a Display or Track) links to its own state-model page when one with
// the same name is documented, so the two halves of a pluggable element — config
// slots and runtime API — reference each other.
function stateModelSection(
  name: string,
  id: string,
  links: DisplayLinkContext,
) {
  return links.modelNames.has(name)
    ? section(
        `### ${name} - State model`,
        `This config's runtime API is documented on its [state model page](../../models/${id}).`,
      )
    : ''
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
  const sections = section(
    displayTypesSection(header.name, links),
    compatibleAdaptersSection(header.name, links),
    usedInSection(header.trackType, links),
    stateModelSection(header.name, header.id, links),
    preProcess &&
      section(
        `### ${header.name} - Pre-processor / simplified config`,
        preProcess.docs,
      ),
    identifier &&
      section(
        `### ${header.name} - Identifier`,
        `Every ${header.name} has a unique \`${identifierField(identifier)}\`, a required top-level field that identifies it (not one of the config slots below).`,
        identifier.docs,
      ),
    slots.length &&
      collapsible(`${header.name} - Slots`, ...slots.map(s => slotBlock(s))),
    inheritedSlotsSection(slots, bases),
    derives &&
      // when the base resolves to a page, the link says it all; only fall back
      // to the raw `baseConfiguration:` code when it couldn't be resolved
      section(
        `### ${header.name} - Derives from`,
        directBase
          ? `- [${directBase.header.name}](../${directBase.header.id})`
          : section(derives.docs, codeBlock(derives.code)),
      ),
  )

  const hasSlots = slots.length > 0 || bases.some(b => b.slots.length > 0)
  const slotsNote = hasSlots
    ? 'See the **Slots** section below for all available configuration fields.'
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
  const docsSection = overviewSection(header.docs, sections)

  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    notes: `Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts.`,
    sourcePath: filename,
    body: section(exSection, docsSection),
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
  } else {
    // an unrecognized key (contextVariable, a non-true flag, ...) can't be
    // summarized on the label line, so keep the source visible
    meta.keepCode = true
  }
}

// The values of a `types.enumeration('Name', ['a', 'b'])` model, so a stringEnum
// slot's choices show on the label line instead of only in the code block.
function enumerationValues(node: ts.Expression): string[] | undefined {
  const arr = ts.isCallExpression(node)
    ? node.arguments.find(ts.isArrayLiteralExpression)
    : undefined
  const values = arr?.elements.filter(ts.isStringLiteralLike).map(e => e.text)
  return values?.length === arr?.elements.length && values?.length
    ? values
    : undefined
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

function slotMetaLine(meta: SlotMeta): string {
  const enums = meta.enumValues
    ? ` (one of ${meta.enumValues.map(v => `\`${v}\``).join(', ')})`
    : ''
  const flags = [meta.advanced && 'advanced', meta.promotable && 'promotable']
    .filter(Boolean)
    .join(', ')
  return [
    meta.type && `**Type:** \`${meta.type}\`${enums}`,
    meta.defaultValue !== undefined && `**Default:** \`${meta.defaultValue}\``,
    flags && `_${flags}_`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function slotBlock({ name, docs, examples, code }: Item) {
  const value = stripPropertyName(code)
  const meta = parseSlotMeta(value)
  return section(
    `#### slot: ${name}`,
    docs || meta.description,
    slotMetaLine(meta),
    meta.keepCode && codeBlock(value),
    exampleSection(examples, '**Example:**'),
  )
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
