import fs from 'fs'

import slugify from 'slugify'
import * as ts from 'typescript'

import {
  codeBlock,
  collapsible,
  collectTransitive,
  docPage,
  exampleSection,
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
function inheritedSlotsSection(bases: ConfigWithHeader[]) {
  const blocks = bases.flatMap(config =>
    config.slots.length
      ? [
          collapsible(
            `Inherited from ${config.header.name}`,
            // a markdown link inside <summary> renders literally, so the link to
            // the base config's own page leads the body instead
            `[${config.header.name} config →](../${config.header.id})`,
            ...config.slots.map(s => slotBlock(s)),
          ),
        ]
      : [],
  )
  return blocks.length
    ? section(
        '## Inherited config slots',
        'Slots available on this config via its base configuration(s), shown in full so this page is self-contained.',
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
interface DisplayLinkContext {
  displayTypesByTrack: Map<string, string[]>
  byName: Map<string, ConfigWithHeader>
  modelNames: Set<string>
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
// (see wrapAdapterExample). Surface that as a link so an adapter page points at
// the track that consumes it — the data was already parsed, just unused here.
function usedInSection(
  trackType: string | undefined,
  links: DisplayLinkContext,
) {
  const track = trackType ? links.byName.get(trackType) : undefined
  return track
    ? section(
        '### Used in',
        `This adapter supplies data to the [${track.header.name}](../${track.header.id}) track type.`,
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
    inheritedSlotsSection(bases),
    derives &&
      section(
        `### ${header.name} - Derives from`,
        directBase
          ? `- [${directBase.header.name}](../${directBase.header.id})`
          : derives.docs,
        codeBlock(derives.code),
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
    notes: `Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag`,
    sourcePath: filename,
    githubDocPath: `website/docs/config/${header.name}.md`,
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
}

// A slot's value is an object literal (`{ type, description, defaultValue, ... }`).
// Surface its fields as prose/labels rather than leaving a reader to parse them
// out of the dumped code: the in-object `description` becomes the slot's prose
// when no JSDoc was written, and type/default render as a compact label line.
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
        if (p.name.text === 'type' && ts.isStringLiteralLike(p.initializer)) {
          meta.type = p.initializer.text
        } else if (
          p.name.text === 'description' &&
          ts.isStringLiteralLike(p.initializer)
        ) {
          meta.description = p.initializer.text
        } else if (p.name.text === 'defaultValue') {
          meta.defaultValue = renderScalarDefault(p.initializer)
        }
      }
    }
  }
  return meta
}

// Only scalar defaults render inline; objects/arrays/callbacks stay in the code
// block below where their shape is legible.
function renderScalarDefault(node: ts.Expression): string | undefined {
  return ts.isStringLiteralLike(node)
    ? `'${node.text}'`
    : ts.isNumericLiteral(node) ||
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
      ? node.getText()
      : undefined
}

function slotMetaLine(meta: SlotMeta): string {
  return [
    meta.type && `**Type:** \`${meta.type}\``,
    meta.defaultValue !== undefined && `**Default:** \`${meta.defaultValue}\``,
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
    codeBlock(value),
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

export async function writeConfigDocs(
  byFile: Record<string, Config>,
  displayTypesByTrack: Map<string, string[]>,
  modelNames: Set<string>,
) {
  const dir = 'website/docs/config'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = withHeaders(byFile)
  const byDeclId = mapByKey(withHeader, c => c.header.declId)
  const byName = mapByKey(withHeader, c => c.header.name)
  const index: ConfigIndex = { byDeclId, byName }
  const links: DisplayLinkContext = { displayTypesByTrack, byName, modelNames }
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
