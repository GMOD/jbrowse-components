import fs from 'fs'

import slugify from 'slugify'

import { writePage } from './format.ts'
import {
  assertSingleHeader,
  assertUniquePages,
  codeCell,
  collectTransitive,
  containsTag,
  docPage,
  exampleCell,
  exampleSection,
  filterUnseenByName,
  headerGaps,
  lookupByIdOrName,
  mapByKey,
  markdownTable,
  parseNode,
  proseCell,
  repoRelative,
  section,
  stripComposedBlock,
  suffixCategory,
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
// routes a member here (also its anchor prefix), the StateModel bucket it lands
// in, its section heading, and which code the Member cell shows: a
// property/volatile is best read as the source line that declares it
// (`types.stripDefault(types.boolean, false)` says more than
// `IOptionalIType<ISimpleType<boolean>, [undefined]>`), everything else as its
// type signature. This one table drives accumulation and every rendered section.
const MEMBER_KINDS: {
  key: MemberKey
  tag: TagType
  label: string
  memberCode: (m: Member) => string
}[] = [
  {
    key: 'properties',
    tag: 'property',
    label: 'Properties',
    memberCode: m => m.code,
  },
  {
    key: 'volatiles',
    tag: 'volatile',
    label: 'Volatiles',
    memberCode: m => m.code,
  },
  {
    key: 'getters',
    tag: 'getter',
    label: 'Getters',
    memberCode: m => m.signature,
  },
  {
    key: 'methods',
    tag: 'method',
    label: 'Methods',
    memberCode: m => m.signature,
  },
  {
    key: 'actions',
    tag: 'action',
    label: 'Actions',
    memberCode: m => m.signature,
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
  // false when the #stateModel JSDoc is attached to a declaration that builds no
  // MST model, so its composition chain (and every inherited member row) is
  // silently empty — see definesStateModel in util.ts
  definesModel?: boolean
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
      definesModel: obj.definesModel,
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

// A per-kind seen-by-name set seeded from a model's own members, so the walk
// outward along the composition chain shows each member once, at its
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
// nothing after dedup are dropped. Mirrors the config page's
// inheritedSlotsSection dedup.
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

// The in-page anchor of a member's row, so another model's page can deep-link
// to the member it inherits from this one.
function memberAnchor(def: MemberKind, name: string) {
  return `${def.tag}-${name.toLowerCase()}`
}

// One row: the member's name over its type/declaration in a single cell, then
// its full documentation, then where it comes from. Name and code share a cell
// so the description gets the width — a member is looked up by name and read by
// description, and a separate type column only squeezes the prose. Long code
// folds (see codeCell) rather than holding the row open.
// An inherited row repeats text that belongs to the ancestor's own page — ~26
// pages carry a copy of every BaseDisplay member — so pagefind is told to index
// it only where it is defined, and a search lands on that model rather than on a
// wall of near-identical descendants. The row still renders for the reader.
// `seen` carries the anchors already emitted on this page, and only the first
// row for a name gets the `id`. A model composed of several sub-models lists
// each one's members in the same table — WorkspaceLayoutMixin has three `id`
// properties and two `size` ones, from LayoutTab, LayoutPanel and LayoutNode —
// and repeating the anchor renders duplicate ids, which the website build
// fails on. The first occurrence keeps the canonical anchor, so every existing
// deep link into these pages still resolves.
function memberRow(
  def: MemberKind,
  m: Member,
  {
    definedBy,
    inherited,
    seen,
  }: { definedBy?: string; inherited: boolean; seen: Set<string> },
) {
  const description = [proseCell(m.docs), exampleCell(m.examples)]
    .filter(Boolean)
    .join('<br>')
  const anchor = memberAnchor(def, m.name)
  const named = seen.has(anchor)
    ? `**${m.name}**`
    : `<span id="${anchor}">**${m.name}**</span>`
  seen.add(anchor)
  const cells = [
    `${named}<br>${codeCell(def.memberCode(m))}`,
    inherited && description
      ? `<span data-pagefind-ignore>${description}</span>`
      : description,
    ...(definedBy === undefined ? [] : [definedBy]),
  ]
  return `| ${cells.join(' | ')} |`
}

// One kind's whole surface as a single table: this model's members first, then
// the (deduped) ones each ancestor contributes, marked in a "Defined by" column
// that links to the ancestor's own page. Inherited members are listed here
// rather than repeated in full further down, so the page states each member
// exactly once and can't disagree with itself. The column disappears entirely
// on a model that composes nothing.
function kindSection(
  def: MemberKind,
  ownName: string,
  ownMembers: Member[],
  inherited: InheritedGroup[],
) {
  const hasInherited = inherited.some(g => g.members[def.key].length)
  const seen = new Set<string>()
  const rows = [
    ...ownMembers.map(m =>
      memberRow(def, m, {
        definedBy: hasInherited ? ownName : undefined,
        inherited: false,
        seen,
      }),
    ),
    ...inherited.flatMap(({ model, members }) =>
      members[def.key].map(m =>
        memberRow(def, m, {
          definedBy: `[${model.header.name}](../${model.header.id}#${memberAnchor(def, m.name)})`,
          inherited: true,
          seen,
        }),
      ),
    ),
  ]
  return rows.length
    ? section(
        `## ${def.label}`,
        markdownTable(
          ['Member', 'Description', ...(hasInherited ? ['Defined by'] : [])],
          rows,
        ),
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
    ? `The configuration slots for this model are documented on its [config schema page](../../config/${id}).`
    : ''
}

function renderModel(
  model: ModelWithHeader,
  ancestors: ModelWithHeader[],
  configNames: Set<string>,
): string {
  const { header, filename } = model
  const inherited = collectInheritedMembers(model.members, ancestors)
  const own = MEMBER_KINDS.reduce((n, k) => n + model.members[k.key].length, 0)

  // the member tables are h2 sections of their own, so the intro prose is
  // emitted bare rather than under an `## Overview` heading it would outweigh
  const body = section(
    exampleSection(header.examples),
    header.docs,
    configLinkSection(header.name, header.id, configNames),
    // A model that composes others and declares nothing of its own renders a
    // page of entirely other models' members, which reads as its surface when
    // none of it is (PreferencesSessionMixin: 52 rows, 43 from BaseSessionModel
    // and 9 from SnackbarModel, 0 its own — it exists for one untagged
    // afterAttach). Say so instead of letting the tables imply otherwise.
    own === 0 &&
      inherited.length &&
      `${header.name} declares no members of its own — it composes the models below, and everything here is theirs.`,
    own > 0 &&
      inherited.length &&
      'Members a composed model contributes are listed here too, so these tables are the whole surface.',
    ...MEMBER_KINDS.map(k =>
      kindSection(k, header.name, model.members[k.key], inherited),
    ),
  )

  const category = stateModelCategory(header.name, header.category)
  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    notes: `Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts.`,
    sourcePath: filename,
    body,
  })
}

/**
 * Every `#property` a model ends up with — its own, plus the ones it inherits
 * through `types.compose`, deduped at the most specific declaration and tagged
 * with the model that declares each.
 *
 * Exported for the session-spec key tables, which document what a spec may set
 * on a view. Own properties alone are not that set: `showHighlightChips` is
 * declared by `HighlightsMixin` and a spec sets it on the linear genome view
 * like any other, so a list built from the view's own file omits a key that
 * works — and a missing row reads as "not settable" exactly the way a blank
 * cell reads as "does nothing".
 */
export function resolvedProperties(
  byFile: Record<string, StateModel>,
  modelName: string,
): { member: Member; declaredBy: string }[] {
  const withHeader = withHeaders(byFile)
  const index: ModelIndex = {
    byDeclId: mapByKey(withHeader, m => m.header.selfDeclId),
    bySlug: mapByKey(withHeader, m => m.header.id),
  }
  const model = withHeader.find(m => m.header.name === modelName)
  if (!model) {
    return []
  }
  return [
    ...model.members.properties.map(member => ({
      member,
      declaredBy: modelName,
    })),
    ...collectInheritedMembers(
      model.members,
      collectAncestors(model, index),
    ).flatMap(g =>
      g.members.properties.map(member => ({
        member,
        declaredBy: g.model.header.name,
      })),
    ),
  ]
}

export function writeModelDocs(
  byFile: Record<string, StateModel>,
  configNames: Set<string>,
) {
  const dir = 'website/docs/models'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = withHeaders(byFile)
  assertUniquePages(
    '#stateModel',
    withHeader.map(m => ({
      name: m.header.name,
      slug: m.header.id,
      filename: m.filename,
    })),
  )
  const index: ModelIndex = {
    byDeclId: mapByKey(withHeader, m => m.header.selfDeclId),
    bySlug: mapByKey(withHeader, m => m.header.id),
  }
  for (const model of withHeader) {
    const ancestors = collectAncestors(model, index)
    writePage(
      `${dir}/${model.header.name}.md`,
      renderModel(model, ancestors, configNames),
    )
  }
  return {
    ...headerGaps({
      items: withHeader,
      getName: m => m.header.name,
      hasExample: m => m.header.examples.length > 0,
      // A model page's #example renders a pasteable config/session snapshot, so
      // the gap only means anything for the categories that appear in one. Every
      // example that has ever been written here is on a Display or a View — 23
      // of 23 — and the other eleven categories have none, because there is no
      // snapshot in which you name a mixin, a session, a root or a widget.
      // Counting them made the list 92 names, of which 80 named a page nobody
      // could fix; the twelve real ones were unfindable inside it. Same failure
      // and the same remedy as the config pass's base-schema exemption below.
      //
      // Internet accounts and connections ARE named in config, and their missing
      // examples are real — but they belong on the config page, which already
      // reports them, and a second copy on the model page would be the same
      // JSON under a different heading.
      wantsExample: m =>
        ['Display', 'View'].includes(
          stateModelCategory(m.header.name, m.header.category),
        ),
      isGeneralCategory: m =>
        stateModelCategory(m.header.name, m.header.category) === 'General',
    }),
    // Reported as a name plus the file, because the fix is positional and the
    // name alone doesn't say where to look.
    misattached: withHeader
      .filter(m => m.header.definesModel === false)
      .map(m => `${m.header.name}\t${m.filename}`),
  }
}
