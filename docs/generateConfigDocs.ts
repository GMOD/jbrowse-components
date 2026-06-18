import fs from 'fs'

import slugify from 'slugify'

import {
  categoryLabel,
  codeBlock,
  exampleSection,
  overviewSection,
  parseTaggedComment,
  removeComments,
  section,
  warnCoverageGap,
  writeFormatted,
} from './util.ts'

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
interface BaseRef {
  config?: ConfigWithHeader
}

function buildItem(obj: ExtractedNode): Item & { category?: string } {
  const { name, docs, examples, category } = parseTaggedComment(
    obj.comment,
    obj.type,
    obj.name,
  )
  return { name, docs, examples, category, code: removeComments(obj.node) }
}

const cwd = `${process.cwd()}/`

// Route one extracted node into its file's config bucket. Called from the shared
// single-program-load driver in generate.ts.
export function accumulateConfig(
  byFile: Record<string, Config>,
  obj: ExtractedNode,
) {
  const fn = obj.filename
  byFile[fn] ??= { slots: [], filename: fn.replace(cwd, '') }
  const file = byFile[fn]
  const item = buildItem(obj)

  if (obj.type === 'config') {
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

// Resolve a config's base: by declaration identity first, else by the config
// name recovered from a dynamic getDisplayType('Name') reference.
function resolveBase(
  config: Config,
  byDeclId: Map<string, ConfigWithHeader>,
  byName: Map<string, ConfigWithHeader>,
) {
  const byId = config.baseDeclId ? byDeclId.get(config.baseDeclId) : undefined
  return (
    byId ??
    (config.baseConfigName ? byName.get(config.baseConfigName) : undefined)
  )
}

// Walk the derivation graph transitively, deduping and guarding cycles. Returns
// bases in reading order (direct base first). A config that derives but whose
// base didn't resolve to a documented #config yields an entry with config
// undefined (so callers can warn).
function collectBaseConfigs(
  config: Config,
  byDeclId: Map<string, ConfigWithHeader>,
  byName: Map<string, ConfigWithHeader>,
  seen = new Set<string>(),
): BaseRef[] {
  const out: BaseRef[] = []
  if (config.derives) {
    const base = resolveBase(config, byDeclId, byName)
    if (!base) {
      out.push({ config: undefined })
    } else if (!seen.has(base.header.id)) {
      seen.add(base.header.id)
      out.push({ config: base })
      out.push(...collectBaseConfigs(base, byDeclId, byName, seen))
    }
  }
  return out
}

// Full slot detail for every inherited config, grouped by the base it comes
// from, so a config page is self-contained — a reader configuring this track
// sees every available slot (own + inherited) without chasing links.
function inheritedSlotsSection(bases: BaseRef[]) {
  const blocks = bases.flatMap(({ config }) =>
    config?.slots.length
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

function renderConfig(
  {
    header,
    derives,
    identifier,
    preProcess,
    slots,
    filename,
  }: ConfigWithHeader,
  bases: BaseRef[],
): string {
  const directBase = bases[0]?.config
  const sections = section(
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

  const hasSlots =
    slots.length > 0 || bases.some(b => (b.config?.slots.length ?? 0) > 0)
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
  return `---
id: ${header.id}
title: ${header.name}
sidebar_label: ${category} -> ${header.name}
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${filename})

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/${header.name}.md)

${section(exSection, docsSection)}
`
}

function slotBlock({ name, docs, examples, code }: Item) {
  return section(
    `#### slot: ${name}`,
    docs,
    codeBlock(code),
    exampleSection(examples, '**Example:**'),
  )
}

function validateBaseConfig(config: ConfigWithHeader, bases: BaseRef[]) {
  for (const { config: base } of bases) {
    if (!base) {
      const codeLine = config.derives?.code.replace(/\s+/g, ' ').trim()
      console.warn(
        `${config.header.name}: baseConfiguration "${codeLine}" could not be resolved to a documented #config`,
      )
    }
  }
}

export async function writeConfigDocs(byFile: Record<string, Config>) {
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
  for (const cfg of withHeader) {
    const bases = collectBaseConfigs(cfg, byDeclId, byName)
    validateBaseConfig(cfg, bases)
    await writeFormatted(
      `${dir}/${cfg.header.name}.md`,
      renderConfig(cfg, bases),
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
