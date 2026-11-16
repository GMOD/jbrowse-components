import slugify from 'slugify'

import {
  agentPage,
  exampleBlock,
  firstParagraph,
  flatCode,
  memberLine,
  pluginOf,
} from './agentText.ts'
import { parseNode } from './docProgram.ts'
import { writePage } from './format.ts'
import { MEMBER_TAGS, isMemberTag, startsWithTag } from './jsDocTags.ts'
import {
  codeCell,
  docPage,
  exampleCell,
  exampleSection,
  markdownTable,
  pageDescription,
  proseCell,
  section,
} from './markdown.ts'
import { configNodeName, unreadableSignature } from './typeSignatures.ts'
import {
  assertSingleHeader,
  assertUniquePages,
  collectTransitive,
  headerGaps,
  lookupByIdOrName,
  mapByKey,
  repoRelative,
  stripPropertyName,
  suffixCategory,
  withHeaders,
} from './util.ts'

import type { ComposedRef, ExtractedNode } from './docProgram.ts'
import type { Example, MemberTag, TagType } from './jsDocTags.ts'

interface Member {
  name: string
  docs: string
  examples: Example[]
  category?: string
  code: string
  signature: string
  propertyDefault?: string
}

// What each member tag (also its anchor prefix) routes a member to: the
// StateModel bucket it lands in, its section heading, and the type the Member
// cell shows. A property whose MST type `propertyType` could not read shows the
// source that declares it. This one table drives accumulation and every
// rendered section.
const MEMBER_KIND = {
  property: {
    key: 'properties',
    label: 'Properties',
    memberCode: m => m.signature || stripPropertyName(m.code),
  },
  volatile: {
    key: 'volatiles',
    label: 'Volatiles',
    memberCode: m => m.signature,
  },
  getter: {
    key: 'getters',
    label: 'Getters',
    memberCode: m => m.signature,
  },
  method: {
    key: 'methods',
    label: 'Methods',
    memberCode: m => m.signature,
  },
  action: {
    key: 'actions',
    label: 'Actions',
    memberCode: m => m.signature,
  },
} as const satisfies Record<
  MemberTag,
  { key: string; label: string; memberCode: (m: Member) => string }
>
type MemberKey = (typeof MEMBER_KIND)[MemberTag]['key']

// The member kinds in render order
export const MEMBER_KINDS = MEMBER_TAGS.map(tag => ({
  tag,
  ...MEMBER_KIND[tag],
}))
type MemberKind = (typeof MEMBER_KINDS)[number]

function byKind<T>(value: (key: MemberKey) => T): Record<MemberKey, T> {
  return {
    properties: value('properties'),
    volatiles: value('volatiles'),
    getters: value('getters'),
    methods: value('methods'),
    actions: value('actions'),
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
  // silently empty — see definesStateModel in docProgram.ts
  definesModel?: boolean
}
export interface StateModel {
  header?: ModelHeader
  members: Record<MemberKey, Member[]>
  filename: string
}
type ModelWithHeader = StateModel & { header: ModelHeader }

function modelIndex(byFile: Record<string, StateModel>) {
  const models = withHeaders(byFile)
  return {
    models,
    byDeclId: mapByKey(models, m => m.header.selfDeclId),
    bySlug: mapByKey(models, m => m.header.id),
  }
}
type ModelIndex = ReturnType<typeof modelIndex>

// Route one extracted node into its file's state-model bucket. Called from the
// shared single-program-load driver in generate.ts.
export function accumulateModel(
  byFile: Record<string, StateModel>,
  obj: ExtractedNode,
) {
  const fn = obj.filename
  byFile[fn] ??= { members: byKind(() => []), filename: repoRelative(fn) }
  const file = byFile[fn]
  const member = parseNode(obj)

  if (obj.type === 'stateModel') {
    // #internal keeps the in-source #stateModel/#property/#action docstrings —
    // which are what a contributor reading the file wants — while dropping the
    // model from the published docs. For internals like SessionLoader, the
    // members are app-shell wiring, not an API a user can call.
    if (startsWithTag(obj.comment, 'internal')) {
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
      docs: member.docs.trim(),
      examples: member.examples,
      id: modelPageId(member.name),
      selfDeclId: obj.selfDeclId,
      composedOf: obj.composedOf,
      category: member.category,
      definesModel: obj.definesModel,
    }
  } else {
    const def = isMemberTag(obj.type) ? MEMBER_KIND[obj.type] : undefined
    if (def) {
      // A later block redefining a member overrides it, as in MST, so the
      // row keeps the first one's place and the override's text.
      const own = file.members[def.key]
      const overridden = own.findIndex(m => m.name === member.name)
      if (overridden === -1) {
        own.push(member)
      } else {
        own[overridden] = member
      }
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
    ref.name ? modelPageId(ref.name) : undefined,
  )
}

// The transitive composition chain, nearest definition first. `types.compose`
// runs its arguments' initializers left to right, so a later argument's member
// replaces an earlier one's; walking each model's parents last-to-first makes
// the first ancestor that declares a name the one whose definition the model
// ends up with. Composed models that don't resolve to a documented #stateModel
// are skipped — they contribute no member section.
function collectAncestors(model: ModelWithHeader, index: ModelIndex) {
  return collectTransitive(
    model,
    m => m.header.id,
    m =>
      m.header.composedOf
        .map(ref => resolveComposedRef(ref, index))
        .filter((m): m is ModelWithHeader => Boolean(m))
        .reverse(),
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

// One ancestor's contribution to a model after dedup: the ancestor itself, plus
// the members it defines that no nearer model (this one, or a closer ancestor)
// already declares.
interface InheritedGroup {
  model: ModelWithHeader
  members: Record<MemberKey, Member[]>
}

function memberNames(members: Record<MemberKey, Member[]>) {
  return MEMBER_KINDS.flatMap(k => members[k.key].map(m => m.name))
}

// The members each ancestor contributes to a model, deduped left-to-right along
// the composition chain: a member the model (or a closer ancestor) redeclares is
// shown once, at its most-specific definition, and dropped from every farther
// ancestor rather than repeated as a live alternative. A name is one member
// whatever its kind, so a model's own `width` getter hides the `width` volatile
// it replaces. Ancestors that contribute nothing after dedup are dropped.
// Mirrors the config page's inheritedSlotsSection dedup.
function collectInheritedMembers(
  ownMembers: Record<MemberKey, Member[]>,
  ancestors: ModelWithHeader[],
): InheritedGroup[] {
  const seen = new Set(memberNames(ownMembers))
  return ancestors
    .map(model => {
      const members = byKind(key =>
        model.members[key].filter(m => !seen.has(m.name)),
      )
      for (const name of memberNames(members)) {
        seen.add(name)
      }
      return { model, members }
    })
    .filter(g => memberNames(g.members).length > 0)
}

// The in-page anchor of a member's row, so another model's page can deep-link
// to the member it inherits from this one.
export function memberAnchor(tag: TagType, name: string) {
  return `${tag}-${name.toLowerCase()}`
}

export function modelPageId(name: string) {
  return slugify(name, { lower: true })
}

// `seen` carries the anchors already emitted on this page, and only the first
// name for an anchor gets the `id`: anchors are lowercased, so two names
// differing only in case would otherwise render duplicate ids, which the
// website build fails on.
function anchored(
  def: MemberKind,
  name: string,
  text: string,
  seen: Set<string>,
) {
  const anchor = memberAnchor(def.tag, name)
  const named = seen.has(anchor) ? text : `<span id="${anchor}">${text}</span>`
  seen.add(anchor)
  return named
}

// One row: the member's name over its type in a single cell, then its full
// documentation. Name and type share a cell so the description gets the width
// — a member is looked up by name and read by description, and a separate type
// column only squeezes the prose. Long code folds (see codeCell) rather than
// holding the row open.
function memberRow(
  def: MemberKind,
  m: Member,
  docs: string,
  seen: Set<string>,
  link: TypeLinker,
) {
  const description = [proseCell(docs), exampleCell(m.examples)]
    .filter(Boolean)
    .join('<br>')
  const defaulted =
    m.propertyDefault === undefined
      ? ''
      : ` · default ${codeCell(m.propertyDefault)}`
  return `| ${anchored(def, m.name, `**${m.name}**`, seen)}<br>${codeCell(def.memberCode(m), link)}${defaulted} | ${description} |`
}

// What one ancestor contributes to a kind: each name, linked to its row on the
// page that documents it. The anchor a full row would carry stays on the name,
// so a deep link into this page still lands. Pagefind indexes a member where it
// is defined, not on every page that composes it.
function inheritedLine(
  def: MemberKind,
  { model, members }: InheritedGroup,
  seen: Set<string>,
) {
  const page = `../${model.header.id}`
  const names = members[def.key].map(m =>
    anchored(
      def,
      m.name,
      `[\`${m.name}\`](${page}#${memberAnchor(def.tag, m.name)})`,
      seen,
    ),
  )
  return {
    count: names.length,
    line: `From [${model.header.name}](${page}): ${names.join(', ')}`,
  }
}

// One kind's whole surface: this model's members as a table, then the (deduped)
// names each ancestor contributes, folded under one count. A full row per
// inherited member put a copy of every BaseDisplay docstring on 21 pages, and
// the unfolded names were a third of this directory's bytes. The docs layout
// opens the fold around a deep link that lands inside it, and a section with no
// rows of its own opens it from the start, since the fold is all it holds.
function kindSection(
  def: MemberKind,
  ownMembers: Member[],
  inherited: InheritedGroup[],
  configPage: string | undefined,
  link: TypeLinker,
) {
  const seen = new Set<string>()
  const rows = ownMembers.map(m =>
    memberRow(def, m, memberDocs(def.key, m, configPage), seen, link),
  )
  const lines = inherited
    .map(g => inheritedLine(def, g, seen))
    .filter(l => l.count > 0)
  const count = lines.reduce((n, l) => n + l.count, 0)
  const noun = count === 1 ? def.tag : def.label.toLowerCase()
  const models = lines.length === 1 ? 'one model' : `${lines.length} models`
  return rows.length || lines.length
    ? section(
        `## ${def.label}`,
        rows.length > 0 && markdownTable(['Member', 'Description'], rows),
        lines.length > 0 &&
          [
            `<details class="inherited-members" data-pagefind-ignore${rows.length ? '' : ' open'}>`,
            `<summary>${count} inherited ${noun} from ${models}</summary>`,
            '',
            lines.map(l => l.line).join('\n\n'),
            '',
            '</details>',
          ].join('\n'),
      )
    : ''
}

// A model and its config schema are two halves of one pluggable element (runtime
// API vs. configuration slots). They live on separate pages under sibling dirs;
// link a model to its config page when one with the same name is documented.
// Name-match mirrors the config-wins-for-shared-name heuristic the site's
// render-layer autolinker uses.
function configPageOf(header: ModelHeader, configNames: Set<string>) {
  return configNames.has(header.name) ? `../../config/${header.id}` : undefined
}

// A member's docs, or for the `id`, `type` and `configuration` properties
// every pluggable element declares, what their declarations already say.
function memberDocs(key: MemberKey, m: Member, configPage?: string) {
  const literal = /^"[^"]*"$/.test(m.signature)
  return (
    m.docs.trim() ||
    (key !== 'properties'
      ? ''
      : m.name === 'type'
        ? literal
          ? `Always \`${m.signature}\`, the name a snapshot selects this model by.`
          : 'The registered name of the concrete type, which a snapshot selects it by.'
        : m.name === 'id'
          ? `The identifier references to this node resolve through. ${m.propertyDefault === undefined ? 'A snapshot must set it.' : 'A snapshot that leaves it out gets a generated one.'}`
          : m.name === 'configuration'
            ? `The config node this model reads its settings from, through \`getConf\`.${configPage ? ` Its slots are documented on its [config schema page](${configPage}).` : ''}`
            : '')
  )
}

function renderModel(
  model: ModelWithHeader,
  ancestors: ModelWithHeader[],
  configNames: Set<string>,
  link: TypeLinker,
): string {
  const { header, filename } = model
  const inherited = collectInheritedMembers(model.members, ancestors)
  const own = memberNames(model.members).length
  const configPage = configPageOf(header, configNames)

  // the member tables are h2 sections of their own, so the intro prose is
  // emitted bare rather than under an `## Overview` heading it would outweigh
  const body = section(
    header.docs,
    exampleSection(header.examples),
    configPage &&
      `The configuration slots for this model are documented on its [config schema page](${configPage}).`,
    // A model that composes others and declares nothing of its own renders a
    // page of entirely other models' members, which reads as its surface when
    // none of it is (PreferencesSessionMixin: 52 rows, 43 from BaseSessionModel
    // and 9 from SnackbarModel, 0 its own — it exists for one untagged
    // afterAttach). Say so instead of letting the tables imply otherwise.
    own === 0 &&
      inherited.length &&
      `${header.name} adds no members: it composes the models below, and every member listed here comes from them.`,
    own > 0 &&
      inherited.length &&
      'Each section ends with the members a composed model contributes, linked to the page that documents them.',
    ...MEMBER_KINDS.map(k =>
      kindSection(k, model.members[k.key], inherited, configPage, link),
    ),
  )

  const category = stateModelCategory(header.name, header.category)
  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    description: pageDescription(
      header.docs,
      `Properties, getters and actions of the ${header.name} state model.`,
    ),
    notes: `Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts.`,
    sourcePath: filename,
    body,
  })
}

// Agents read a member as a name, a signature and a sentence, never a table, and
// they read the inherited members in the same list — composition is how the
// model is built, not something to follow to another page. Actions first: they
// are what an agent came to find out how to call.
//
// No volatiles: 170 KB of the bundled corpus was mouse and hover state
// (featureIdUnderMouse, contextMenuFeature) that an agent must not write and
// gains nothing by reading. The website page still lists them.
const AGENT_KIND_ORDER: MemberTag[] = ['action', 'getter', 'property', 'method']

function renderAgentModel(
  model: ModelWithHeader,
  ancestors: ModelWithHeader[],
  configNames: Set<string>,
) {
  const { header, filename } = model
  const inherited = collectInheritedMembers(model.members, ancestors)
  const category = stateModelCategory(header.name, header.category)
  const membersOf = (key: MemberKey) => [
    ...model.members[key],
    ...inherited.flatMap(g => g.members[key]),
  ]
  const sections = AGENT_KIND_ORDER.map(tag => {
    const kind = MEMBER_KIND[tag]
    const { key } = kind
    return {
      heading: kind.label,
      lines: membersOf(key).map(m =>
        memberLine(
          m.name,
          key === 'properties'
            ? propertyText(m)
            : key === 'getters'
              ? `: ${flatCode(kind.memberCode(m))}`
              : flatCode(kind.memberCode(m)),
          memberDocs(key, m),
        ),
      ),
    }
  })
  const composed = ancestors.map(a => a.header.name)
  return {
    category,
    text: agentPage(
      `${header.name} (${category} model, ${pluginOf(filename)})`,
      [
        firstParagraph(header.docs, 600),
        configNames.has(header.name) &&
          `Config slots: docs topic "config:${header.name}" (or jb.describeSlots(node.configuration) live).`,
        composed.length > 0 &&
          `Composes ${composed.join(', ')} — their members are listed below, nothing to follow.`,
        exampleBlock(header.examples[0]?.content),
      ],
      sections,
    ),
  }
}

/**
 * Every `#property` a model ends up with — its own, plus the ones it inherits
 * through `types.compose`, deduped at the most specific declaration and tagged
 * with the model that declares each.
 *
 * Exported for the session-spec key tables, which document what a spec may set
 * on a view. Own properties alone are not that set: `minimized` is declared by
 * `BaseViewModel` and a spec sets it on the linear genome view like any
 * other, so a list built from the view's own file omits a key that works — and
 * a missing row reads as "not settable" exactly the way a blank cell reads as
 * "does nothing".
 */
export function resolvedProperties(
  byFile: Record<string, StateModel>,
  modelName: string,
): { member: Member; declaredBy: string }[] {
  const index = modelIndex(byFile)
  const model = index.models.find(m => m.header.name === modelName)
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

// `windowStartBp: number = 0`, or the declaring source when the type could
// not be read.
function propertyText(m: Member) {
  return m.signature
    ? `: ${flatCode(m.signature)}${m.propertyDefault === undefined ? '' : ` = ${flatCode(m.propertyDefault)}`}`
    : ` = ${flatCode(stripPropertyName(m.code))}`
}

type TypeLinker = (html: string) => string

// A signature names another model, or a config node as `<schema>Config`, where
// the generator printed a name in place of the expanded type (`printedTypes`),
// and a property's source names the models it holds. Each name links to its
// page. Quoted strings stay text, so `types.literal('LinearWiggleDisplay')`
// links nothing.
function typeLinker(modelNames: string[], configNames: Set<string>) {
  // A written annotation names a node by the codebase's aliases for it
  // (`LinearGenomeViewModel`, `BaseAssemblyConfigModel`); a page name, added
  // last, wins over an alias that happens to spell it.
  const pages = new Map([
    ...[...configNames].flatMap(name => {
      const page = `../../config/${modelPageId(name)}`
      const node = configNodeName(name)
      return [
        [`${node}Model`, page],
        [node, page],
      ] as const
    }),
    ...modelNames.flatMap(name => {
      const page = `../${modelPageId(name)}`
      return [
        [`${name}Model`, page],
        [name, page],
      ] as const
    }),
  ])
  const token = new RegExp(
    `(["'\`])(?:(?!\\1)[^\\\\]|\\\\.)*\\1|\\b(?:${[...pages.keys()].join('|')})\\b`,
    'g',
  )
  return (html: string) =>
    html.replace(token, word => {
      const page = pages.get(word)
      return page ? `<a href="${page}">${word}</a>` : word
    })
}

// Each documented model with its page and its agent text.
export function renderModels(
  byFile: Record<string, StateModel>,
  configNames: Set<string>,
) {
  const index = modelIndex(byFile)
  const link = typeLinker(
    index.models.map(m => m.header.name),
    configNames,
  )
  return index.models.map(model => {
    const ancestors = collectAncestors(model, index)
    return {
      model,
      page: renderModel(model, ancestors, configNames, link),
      agent: renderAgentModel(model, ancestors, configNames),
    }
  })
}

export function writeModelDocs(
  byFile: Record<string, StateModel>,
  configNames: Set<string>,
) {
  const dir = 'website/docs/models'
  const rendered = renderModels(byFile, configNames)
  const withHeader = rendered.map(r => r.model)
  assertUniquePages(
    '#stateModel',
    withHeader.map(m => ({
      name: m.header.name,
      slug: m.header.id,
      filename: m.filename,
    })),
  )
  for (const { model, page } of rendered) {
    writePage(`${dir}/${model.header.name}.md`, page)
  }
  return {
    agentPages: Object.fromEntries(
      rendered.map(r => [r.model.header.name, r.agent]),
    ),
    ...headerGaps({
      items: withHeader,
      getName: m => m.header.name,
      getDocs: m => m.header.docs,
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
    undocumented: withHeader.flatMap(m =>
      MEMBER_KINDS.flatMap(k =>
        m.members[k.key]
          .filter(member => !memberDocs(k.key, member))
          .map(member => `${m.header.name}.${member.name}`),
      ),
    ),
    // A member whose cell prints MST internals or collapses to nothing: the
    // model it names has no `#stateModel` tag for `printedTypes` to name it by,
    // or nothing in the source names the type it returns. A property shows its
    // source instead, so it counts when `propertyType` could not read it.
    unreadableTypes: withHeader.flatMap(m =>
      MEMBER_KINDS.flatMap(k =>
        m.members[k.key]
          .filter(member =>
            k.key === 'properties'
              ? !member.signature
              : unreadableSignature(k.memberCode(member)),
          )
          .map(member => `${m.header.name}.${member.name}`),
      ),
    ),
    // Reported as a name plus the file, because the fix is positional and the
    // name alone doesn't say where to look.
    misattached: withHeader
      .filter(m => m.header.definesModel === false)
      .map(m => `${m.header.name}\t${m.filename}`),
  }
}
