import fs from 'fs'

import slugify from 'slugify'

import {
  collapsibleClosed,
  collectTransitive,
  docPage,
  exampleSection,
  lookupByIdOrName,
  mapByKey,
  markdownTable,
  overviewSection,
  parseNode,
  repoRelative,
  section,
  stripComposedBlock,
  suffixCategory,
  tableCell,
  typeAliasBlock,
  typeAndCodeBlock,
  assertSingleHeader,
  warnHeaderGaps,
  withHeaders,
} from './util.ts'
import { writeFormatted } from './format.ts'

import type { ComposedRef, Example, ExtractedNode, TagType } from './util.ts'

interface Member {
  name: string
  docs: string
  examples: Example[]
  category?: string
  code: string
  signature: string
}
type MemberKey = 'properties' | 'volatiles' | 'getters' | 'methods' | 'actions'

// The five MST member kinds in render order. Each row ties together the tag that
// routes a member here (also the `#### <tag>: <name>` heading + anchor slug), the
// StateModel bucket it lands in, its plural section label, and how its body
// renders. This one table drives accumulation, the per-model member sections, and
// the inherited-member index, so the five-fold parallelism has a single source.
const MEMBER_KINDS: {
  key: MemberKey
  tag: TagType
  label: string
  renderBody: (m: Member) => string
}[] = [
  {
    key: 'properties',
    tag: 'property',
    label: 'Properties',
    renderBody: m => typeAndCodeBlock(m.name, m.signature, m.code),
  },
  {
    key: 'volatiles',
    tag: 'volatile',
    label: 'Volatiles',
    renderBody: m => typeAndCodeBlock(m.name, m.signature, m.code),
  },
  {
    key: 'getters',
    tag: 'getter',
    label: 'Getters',
    renderBody: m => typeAliasBlock(m.name, m.signature),
  },
  {
    key: 'methods',
    tag: 'method',
    label: 'Methods',
    renderBody: m => typeAliasBlock(m.name, m.signature),
  },
  {
    key: 'actions',
    tag: 'action',
    label: 'Actions',
    renderBody: m => typeAliasBlock(m.name, m.signature),
  },
]
type MemberKind = (typeof MEMBER_KINDS)[number]

function emptyMembers(): Record<MemberKey, Member[]> {
  return {
    properties: [],
    volatiles: [],
    getters: [],
    methods: [],
    actions: [],
  }
}

interface ModelHeader {
  name: string
  id: string
  docs: string
  examples: Example[]
  // declId of this model's own declaration; keys the byDeclId map so a composed
  // reference can be matched back to the model page it documents.
  selfDeclId?: string
  // the models this one composes (derived from its types.compose call)
  composedOf: ComposedRef[]
  // explicit #category tag value, e.g. "session" — wins over the name-suffix
  // heuristic in stateModelCategory() when present (except *Mixin names, which
  // always bucket under "Mixin" regardless of this tag)
  category?: string
}
export interface StateModel {
  header?: ModelHeader
  members: Record<MemberKey, Member[]>
  filename: string
}
type ModelWithHeader = StateModel & { header: ModelHeader }
interface ModelIndex {
  byDeclId: Map<string, ModelWithHeader>
  bySlug: Map<string, ModelWithHeader>
}

// Route one extracted node into its file's state-model bucket. Called from the
// shared single-program-load driver in generate.ts.
export function accumulateModel(
  byFile: Record<string, StateModel>,
  obj: ExtractedNode,
) {
  const fn = obj.filename
  byFile[fn] ??= { members: emptyMembers(), filename: repoRelative(fn) }
  const file = byFile[fn]
  const member = parseNode(obj)

  if (obj.type === 'stateModel') {
    assertSingleHeader({
      filename: file.filename,
      tag: 'stateModel',
      existing: file.header?.name,
      incoming: member.name,
    })
    file.header = {
      name: member.name,
      docs: stripComposedBlock(member.docs),
      examples: member.examples,
      id: slugify(member.name, { lower: true }),
      selfDeclId: obj.selfDeclId,
      composedOf: obj.composedOf ?? [],
      category: member.category,
    }
  } else {
    const def = MEMBER_KINDS.find(k => k.tag === obj.type)
    if (def) {
      file.members[def.key].push(member)
    }
  }
}

// One composed reference resolved to the documented #stateModel it names, by
// declId first then by slugified name. References to models that aren't
// documented #stateModels (plain types.model mixins, config bases) resolve to
// undefined.
function resolveComposedRef(ref: ComposedRef, index: ModelIndex) {
  return lookupByIdOrName(
    index.byDeclId,
    index.bySlug,
    ref.declId,
    ref.name ? slugify(ref.name, { lower: true }) : undefined,
  )
}

// The transitive composition chain (direct parents first), via the shared graph
// walk. Composed models that don't resolve to a documented #stateModel are
// skipped — they contribute no member section.
function collectAncestors(model: ModelWithHeader, index: ModelIndex) {
  return collectTransitive(
    model,
    m => m.header.id,
    m =>
      m.header.composedOf
        .map(ref => resolveComposedRef(ref, index))
        .filter((m): m is ModelWithHeader => Boolean(m)),
  )
}

// Name-suffix heuristic for a model's sidebar category, checked in order. The
// `Assembly`/`AssemblyManager` rows match those exact names via endsWith.
const MODEL_CATEGORIES: [string, string][] = [
  ['View', 'View'],
  ['Display', 'Display'],
  ['ConnectionModel', 'Connection'],
  ['Connection', 'Connection'],
  ['InternetAccount', 'Internet Account'],
  ['WidgetModel', 'Widget'],
  ['Widget', 'Widget'],
  ['SessionModel', 'Session'],
  ['RootModel', 'Root'],
  ['ConfigModel', 'Root'],
  ['AssemblyManager', 'Assembly Management'],
  ['Assembly', 'Assembly Management'],
]

// A `*Mixin` name always wins, regardless of any #category tag: composition
// mixins are never used standalone, so grouping them under one "Mixin" bucket
// keeps the domain categories (Display, Session, Root, ...) limited to models a
// reader would actually instantiate. Otherwise the shared explicit-tag / suffix /
// General resolution applies.
function stateModelCategory(name: string, explicit?: string): string {
  return name.endsWith('Mixin')
    ? 'Mixin'
    : suffixCategory(name, explicit, MODEL_CATEGORIES)
}

// One inherited-member line, e.g.
// "**Getters:** [width](../baseviewmodel#getter-width), ...". Each name links
// straight to its `#### <tag>: <name>` heading on the model that defines it; the
// anchor mirrors the github-slugger id Astro derives for that heading
// (`<tag>-<name lowercased>`), so the link lands on the member — modern browsers
// auto-expand the enclosing collapsed <details> on fragment navigation.
function memberLine(modelId: string, def: MemberKind, members: Member[]) {
  return members.length
    ? `**${def.label}:** ${members
        .map(
          m => `[${m.name}](../${modelId}#${def.tag}-${m.name.toLowerCase()})`,
        )
        .join(', ')}`
    : ''
}

// A compact, single-page overview of every member reachable through
// composition, grouped by the model that defines it, so a reader does not have
// to traverse the whole inheritance chain to learn what is available.
function inheritedSection(ancestors: ModelWithHeader[]) {
  const blocks = ancestors.flatMap(model => {
    const lines = MEMBER_KINDS.map(k =>
      memberLine(model.header.id, k, model.members[k.key]),
    ).filter(Boolean)
    return lines.length
      ? [
          section(
            `### Available via [${model.header.name}](../${model.header.id})`,
            ...lines,
          ),
        ]
      : []
  })
  return blocks.length
    ? section(
        '## Inherited members',
        'Available on this model via composition. Follow each link for full signatures and docs.',
        ...blocks,
      )
    : ''
}

// One row of the own-members table: name (linked to its full entry below),
// kind, and a one-line description — empty for "plumbing" members that carry
// no JSDoc, which itself is useful signal (nothing to read there).
function memberRow(def: MemberKind, m: Member) {
  return `| [${m.name}](#${def.tag}-${m.name.toLowerCase()}) | ${def.label} | ${tableCell(m.docs)} |`
}

// A real table of this model's own members (not inherited — see
// inheritedSection for that): name, kind, and description at a glance, each
// linking to its full entry below. The full entries are collapsed by default
// (see memberSection) since a model can carry hundreds of them, so this table
// — placed right under the intro prose — is both the fast way to find one and
// the fast way to see what's actually documented, rather than scrolling past
// every member; the site's own table of contents only goes down to h2/h3 and
// misses these h4 member headings entirely.
function memberIndexSection(members: Record<MemberKey, Member[]>) {
  const rows = MEMBER_KINDS.flatMap(k =>
    members[k.key].map(m => memberRow(k, m)),
  )
  return rows.length
    ? section(
        '## Members',
        markdownTable(['Member', 'Kind', 'Description'], rows),
      )
    : ''
}

// A model and its config schema are two halves of one pluggable element (runtime
// API vs. configuration slots). They live on separate pages under sibling dirs;
// link a model to its config page when one with the same name is documented.
// Name-match mirrors the config-wins-for-shared-name heuristic the site's
// render-layer autolinker uses.
function configLinkSection(name: string, id: string, configNames: Set<string>) {
  return configNames.has(name)
    ? section(
        `### ${name} - Configuration`,
        `The configuration slots for this model are documented on its [config schema page](../../config/${id}).`,
      )
    : ''
}

function renderModel(
  model: ModelWithHeader,
  ancestors: ModelWithHeader[],
  configNames: Set<string>,
): string {
  const { header, filename } = model
  const sections = section(
    ...MEMBER_KINDS.map(k =>
      memberSection(header.name, k, model.members[k.key]),
    ),
  )

  const exSection = exampleSection(header.examples)
  const docsSection = overviewSection(
    header.docs,
    memberIndexSection(model.members),
    configLinkSection(header.name, header.id, configNames),
    inheritedSection(ancestors),
    sections,
  )

  const category = stateModelCategory(header.name, header.category)
  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    notes: `Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts.`,
    sourcePath: filename,
    body: section(exSection, docsSection),
  })
}

// A member is "documented" — worth rendering in full and up front — when its
// author wrote prose or an #example for it. Everything else is plumbing (bare
// setters, internal accessors) that the structural pass recovered only so the
// API surface stays complete; those get compacted into a table below.
function isDocumented(m: Member) {
  return Boolean(m.docs.trim()) || m.examples.length > 0
}

// One full member entry: heading, prose, code/type block, and any #example.
function memberEntry(def: MemberKind, m: Member) {
  return section(
    `#### ${def.tag}: ${m.name}`,
    m.docs,
    def.renderBody(m),
    exampleSection(m.examples, '**Example:**'),
  )
}

// Both documented members and undocumented "plumbing" ones (bare setters,
// internal accessors) render in full, one folded-closed block per kind — the
// memberIndexSection index above is the primary way in, so nothing needs to
// start expanded. Their `#### <tag>: <name>` headings are the anchor targets
// that index and other pages' "Inherited members" links point at; fragment
// navigation auto-expands the block on landing.
function memberSection(modelName: string, def: MemberKind, members: Member[]) {
  if (!members.length) {
    return ''
  }
  const documented = members.filter(isDocumented)
  const plumbing = members.filter(m => !isDocumented(m))
  return section(
    documented.length
      ? collapsibleClosed(
          `${modelName} - ${def.label}`,
          ...documented.map(m => memberEntry(def, m)),
        )
      : '',
    plumbing.length
      ? collapsibleClosed(
          documented.length
            ? `${modelName} - ${def.label} (other undocumented members)`
            : `${modelName} - ${def.label}`,
          ...plumbing.map(m => memberEntry(def, m)),
        )
      : '',
  )
}

export async function writeModelDocs(
  byFile: Record<string, StateModel>,
  configNames: Set<string>,
) {
  const dir = 'website/docs/models'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = withHeaders(byFile)
  const index: ModelIndex = {
    byDeclId: mapByKey(withHeader, m => m.header.selfDeclId),
    bySlug: mapByKey(withHeader, m => m.header.id),
  }
  for (const model of withHeader) {
    const ancestors = collectAncestors(model, index)
    await writeFormatted(
      `${dir}/${model.header.name}.md`,
      renderModel(model, ancestors, configNames),
    )
  }
  warnHeaderGaps({
    items: withHeader,
    kind: 'models',
    getName: m => m.header.name,
    hasExample: m => m.header.examples.length > 0,
    isGeneralCategory: m =>
      stateModelCategory(m.header.name, m.header.category) === 'General',
  })
}
