import fs from 'fs'

import slugify from 'slugify'

import { writeFormatted } from './format.ts'
import {
  assertSingleHeader,
  collapsibleClosed,
  collectTransitive,
  containsTag,
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
  stripComposedBlock,
  suffixCategory,
  tableCell,
  typeAliasBlock,
  typeAndCodeBlock,
  warnHeaderGaps,
  withHeaders,
} from './util.ts'

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
    // #internal keeps the in-source #stateModel/#property/#action docstrings —
    // which are what a contributor reading the file wants — while dropping the
    // model from the published docs. For internals like SessionLoader, the
    // members are app-shell wiring, not an API a user can call.
    if (containsTag(obj.comment, 'internal')) {
      return
    }
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

// A per-kind seen-by-name set seeded from a model's own members, so
// inheritedSection can walk outward and show each member once, at its
// most-specific definition (see filterUnseenByName). Built explicitly per kind
// like emptyMembers() so it stays type-safe without a cast.
function seenByKind(members: Record<MemberKey, Member[]>) {
  return {
    properties: new Set(members.properties.map(m => m.name)),
    volatiles: new Set(members.volatiles.map(m => m.name)),
    getters: new Set(members.getters.map(m => m.name)),
    methods: new Set(members.methods.map(m => m.name)),
    actions: new Set(members.actions.map(m => m.name)),
  }
}

// One ancestor's contribution to a model after dedup: the ancestor itself, plus
// the members it defines that no nearer model (this one, or a closer ancestor)
// already declares.
interface InheritedGroup {
  model: ModelWithHeader
  members: Record<MemberKey, Member[]>
}

// The members each ancestor contributes to a model, deduped left-to-right along
// the composition chain: a member the model (or a closer ancestor) redeclares is
// shown once, at its most-specific definition, and dropped from every farther
// ancestor rather than repeated as a live alternative. Ancestors that contribute
// nothing after dedup are dropped. Built once and shared by memberIndexSection
// (the page's member table) and inheritedSection (the full entries) so the two
// can never disagree about which inherited members exist. Mirrors the config
// page's inheritedSlotsSection dedup.
function collectInheritedMembers(
  ownMembers: Record<MemberKey, Member[]>,
  ancestors: ModelWithHeader[],
): InheritedGroup[] {
  const seen = seenByKind(ownMembers)
  return ancestors
    .map(model => ({
      model,
      members: {
        properties: filterUnseenByName(
          seen.properties,
          model.members.properties,
        ),
        volatiles: filterUnseenByName(seen.volatiles, model.members.volatiles),
        getters: filterUnseenByName(seen.getters, model.members.getters),
        methods: filterUnseenByName(seen.methods, model.members.methods),
        actions: filterUnseenByName(seen.actions, model.members.actions),
      },
    }))
    .filter(g => MEMBER_KINDS.some(k => g.members[k.key].length))
}

// Full member entries for everything reachable through composition: one
// folded-closed block per ancestor, members grouped inside under bold kind
// labels, linked back to that ancestor's own page — so the page is
// self-contained (a reader sees every available member in full, here) while a
// deep chain collapses to one fold per ancestor instead of one per kind. The
// documented/plumbing split memberSection draws for own members is dropped
// here: the ## Members table above already carries that signal (its Description
// column is empty exactly for plumbing). Renders the same (deduped) groups the
// table indexes. Mirrors the config page's inheritedSlotsSection.
function inheritedSection(inherited: InheritedGroup[]) {
  const blocks = inherited.map(({ model, members }) =>
    collapsibleClosed(
      `Derived from ${model.header.name}`,
      // a markdown link inside <summary> renders literally, so the link to the
      // ancestor's own page leads the body instead
      `[${model.header.name} →](../${model.header.id})`,
      ...MEMBER_KINDS.flatMap(k => inheritedKindBlocks(k, members[k.key])),
    ),
  )
  return blocks.length
    ? section(
        '## Inherited members',
        'Members available on this model via composition, shown in full so this page is self-contained. A member redeclared by a more specific model is shown once, at its most-specific definition.',
        ...blocks,
      )
    : ''
}

// The in-page anchor of a member's entry: the github-slugger id of its
// `#### <tag>: <name>` heading. Plumbing members render as table rows rather
// than headings, so plumbingTable emits this id explicitly — either way the
// members index can link to every member on the page.
function memberAnchor(def: MemberKind, name: string) {
  return `${def.tag}-${name.toLowerCase()}`
}

// One row of the members table: name (linked to its full entry below), kind,
// the model that defines it, and a one-line description — empty for "plumbing"
// members that carry no JSDoc, which itself is useful signal (nothing to read
// there). `definedBy` is this model's own name for own members and a link to
// the ancestor's page for inherited ones. The description is trimmed to its
// first sentence, as on the config pages' slot table: the full text is in the
// entry the row links into, and a paragraph in a cell defeats the scan.
function memberRow(def: MemberKind, m: Member, definedBy: string) {
  return `| [${m.name}](#${memberAnchor(def, m.name)}) | ${def.label} | ${definedBy} | ${tableCell(m.docs && firstSentence(m.docs))} |`
}

// A real table of every member available on this model — its own first, then
// each ancestor's (deduped) contributions — with a "Defined by" column marking
// the source, each row linking to its full entry below (own members render in
// the sections directly under this table, inherited ones under "Inherited
// members"). It is a true index of the whole self-contained page: the full
// entries are collapsed by default (see memberSection) since a model can carry
// hundreds of them, so this table — placed right under the intro prose — is both
// the fast way to find one and the fast way to see what's documented, rather
// than scrolling past every member; the site's own table of contents only goes
// down to h2/h3 and misses these h4 member headings entirely.
function memberIndexSection(
  ownName: string,
  ownMembers: Record<MemberKey, Member[]>,
  inherited: InheritedGroup[],
) {
  const ownRows = MEMBER_KINDS.flatMap(k =>
    ownMembers[k.key].map(m => memberRow(k, m, ownName)),
  )
  const inheritedRows = inherited.flatMap(({ model, members }) => {
    const link = `[${model.header.name}](../${model.header.id})`
    return MEMBER_KINDS.flatMap(k =>
      members[k.key].map(m => memberRow(k, m, link)),
    )
  })
  const rows = [...ownRows, ...inheritedRows]
  return rows.length
    ? section(
        '## Members',
        markdownTable(['Member', 'Kind', 'Defined by', 'Description'], rows),
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
  const inherited = collectInheritedMembers(model.members, ancestors)
  const sections = section(
    ...MEMBER_KINDS.map(k =>
      memberSection(header.name, k, model.members[k.key]),
    ),
  )

  const exSection = exampleSection(header.examples)
  const docsSection = overviewSection(
    header.docs,
    memberIndexSection(header.name, model.members, inherited),
    configLinkSection(header.name, header.id, configNames),
    sections,
    inheritedSection(inherited),
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

// Undocumented plumbing carries nothing but a name and a type, so a full entry
// spends five lines of heading and code fence on one fact — and on a display
// model those members outnumber the documented ones two to one. One row each
// instead: the whole API surface is still on the page (a reader never has to
// leave it), but it reads as a list rather than as source. The explicit
// `<span id>` reproduces the anchor the heading would have had, so the members
// index and other pages' inherited links still land on the right row.
function plumbingTable(def: MemberKind, members: Member[]) {
  return markdownTable(
    ['Member', 'Type'],
    members.map(
      m =>
        `| <span id="${memberAnchor(def, m.name)}">${m.name}</span> | ${m.signature ? `\`${tableCell(m.signature)}\`` : ''} |`,
    ),
  )
}

// Every member of one kind, folded closed — the memberIndexSection index above
// is the primary way in, so nothing needs to start expanded. Documented members
// render in full; the rest compact into plumbingTable.
function memberSection(modelName: string, def: MemberKind, members: Member[]) {
  const documented = members.filter(isDocumented)
  const plumbing = members.filter(m => !isDocumented(m))
  return section(
    documented.length &&
      collapsibleClosed(
        `${modelName} - ${def.label}`,
        ...documented.map(m => memberEntry(def, m)),
      ),
    plumbing.length &&
      collapsibleClosed(
        documented.length
          ? `${modelName} - ${def.label} (other undocumented members)`
          : `${modelName} - ${def.label}`,
        plumbingTable(def, plumbing),
      ),
  )
}

// One kind's members inside an ancestor's block: same documented/plumbing split
// as memberSection, under a bold kind label rather than its own fold (the
// ancestor block is already one fold).
function inheritedKindBlocks(def: MemberKind, members: Member[]) {
  const documented = members.filter(isDocumented)
  const plumbing = members.filter(m => !isDocumented(m))
  return members.length
    ? [
        `**${def.label}**`,
        ...documented.map(m => memberEntry(def, m)),
        ...(plumbing.length ? [plumbingTable(def, plumbing)] : []),
      ]
    : []
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
