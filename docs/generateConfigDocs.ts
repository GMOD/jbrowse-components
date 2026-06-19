import fs from 'fs'

import slugify from 'slugify'

import {
  categoryLabel,
  codeBlock,
  collectTransitive,
  docPage,
  exampleSection,
  overviewSection,
  parseTaggedComment,
  removeComments,
  repoRelative,
  section,
  warnCoverageGap,
} from './util.ts'
import { writeFormatted } from './format.ts'

import type { Example, ExtractedNode } from './util.ts'

interface Item {
  name: string
  docs: string
  examples: Example[]
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

function buildItem(obj: ExtractedNode): Item & { category?: string } {
  const { name, docs, examples, category } = parseTaggedComment(
    obj.comment,
    obj.type,
    obj.name,
  )
  return { name, docs, examples, category, code: removeComments(obj.node) }
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
  const item = buildItem(obj)

  if (obj.type === 'config') {
    // A #config const is tagged twice (VariableStatement + its inner
    // declaration); the statement half can resolve to an empty name when the tag
    // carries none, so only treat two *non-empty, differently named* #config in
    // one file as the violation the README warns about (the second silently
    // wins).
    if (
      file.header &&
      file.header.name &&
      item.name &&
      item.name !== file.header.name
    ) {
      console.warn(
        `${file.filename}: multiple #config tags ("${file.header.name}" then "${item.name}"); only the last is documented (one #config per file)`,
      )
    }
    file.header = {
      name: item.name,
      docs: item.docs,
      examples: item.examples,
      id: slugify(item.name, { lower: true }),
      declId: obj.selfDeclId,
      category: item.category,
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
  const byId = config.baseDeclId
    ? index.byDeclId.get(config.baseDeclId)
    : undefined
  const byName = config.baseConfigName
    ? index.byName.get(config.baseConfigName)
    : undefined
  return config.derives ? (byId ?? byName) : undefined
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
          section(
            `### Inherited from [${config.header.name}](../${config.header.id})`,
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

// Determine the sidebar category for a config: an explicit #category tag wins,
// else fall back to a name-suffix heuristic.
function configCategory(name: string, explicit?: string): string {
  if (explicit) {
    return categoryLabel(explicit)
  } else if (name.endsWith('Adapter')) {
    return 'Adapter'
  } else if (name.endsWith('Track')) {
    return 'Track'
  } else if (name.endsWith('Display')) {
    return 'Display'
  } else if (name.endsWith('Connection')) {
    return 'Connection'
  } else if (name.endsWith('InternetAccount')) {
    return 'Internet Account'
  } else {
    return 'General'
  }
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
    preProcess &&
      section(
        `### ${header.name} - Pre-processor / simplified config`,
        preProcess.docs,
      ),
    identifier &&
      section(
        `### ${header.name} - Identifier`,
        `#### slot: ${identifier.name}`,
      ),
    slots.length &&
      section(
        `### ${header.name} - Slots`,
        slots.map(s => slotBlock(s)).join('\n'),
      ),
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
  const exSection = exampleSection(
    header.examples,
    '## Example usage',
    slotsNote,
  )
  const docsSection = overviewSection(header.docs, sections)

  const category = configCategory(header.name, header.category)
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

function slotBlock({ name, docs, examples, code }: Item) {
  return section(
    `#### slot: ${name}`,
    docs,
    codeBlock(code),
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

export async function writeConfigDocs(
  byFile: Record<string, Config>,
  displayTypesByTrack: Map<string, string[]>,
  modelNames: Set<string>,
) {
  const dir = 'website/docs/config'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = Object.values(byFile).filter((c): c is ConfigWithHeader =>
    Boolean(c.header),
  )
  const byDeclId = new Map(
    withHeader
      .filter(c => c.header.declId)
      .map(c => [c.header.declId!, c] as const),
  )
  const byName = new Map(withHeader.map(c => [c.header.name, c] as const))
  const index: ConfigIndex = { byDeclId, byName }
  const links: DisplayLinkContext = { displayTypesByTrack, byName, modelNames }
  warnUnresolvedBases(withHeader, index)
  for (const cfg of withHeader) {
    await writeFormatted(
      `${dir}/${cfg.header.name}.md`,
      renderConfig(cfg, collectBaseConfigs(cfg, index), links),
    )
  }
  warnCoverageGap(
    withHeader.filter(c => !c.header.examples.length),
    withHeader.length,
    'configs',
    'have no #example',
    c => c.header.name,
  )
  warnCoverageGap(
    withHeader.filter(
      c => configCategory(c.header.name, c.header.category) === 'General',
    ),
    withHeader.length,
    'configs',
    'resolved to the General category (consider adding #category)',
    c => c.header.name,
  )
}
