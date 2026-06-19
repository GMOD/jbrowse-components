import fs from 'fs'

import slugify from 'slugify'

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
  stripComposedBlock,
  suffixCategory,
  warnDuplicateHeader,
  warnHeaderGaps,
  withHeaders,
} from './util.ts'
import { writeFormatted } from './format.ts'

import type { ComposedRef, Example, ExtractedNode } from './util.ts'

interface Member {
  name: string
  docs: string
  examples: Example[]
  category?: string
  code: string
  signature: string
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
  properties: Member[]
  volatiles: Member[]
  getters: Member[]
  methods: Member[]
  actions: Member[]
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
  byFile[fn] ??= {
    properties: [],
    volatiles: [],
    getters: [],
    methods: [],
    actions: [],
    filename: repoRelative(fn),
  }
  const file = byFile[fn]
  const member = parseNode(obj)

  if (obj.type === 'stateModel') {
    warnDuplicateHeader({
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
  } else if (obj.type === 'property') {
    file.properties.push(member)
  } else if (obj.type === 'volatile') {
    file.volatiles.push(member)
  } else if (obj.type === 'getter') {
    file.getters.push(member)
  } else if (obj.type === 'method') {
    file.methods.push(member)
  } else if (obj.type === 'action') {
    file.actions.push(member)
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

// Singular heading kind a plural section label maps to: "Getters" -> "getter",
// "Properties" -> "property". Shared by the member-section headings and the
// inherited-member anchor links so the slug used in both never drifts.
function memberKind(label: string) {
  return label.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')
}

// One inherited-member line, e.g.
// "**Getters:** [width](../baseviewmodel#getter-width), ...". Each name links
// straight to its `#### <kind>: <name>` heading on the model that defines it; the
// anchor mirrors the github-slugger id Astro derives for that heading
// (`<kind>-<name lowercased>`), so the link lands on the member — modern browsers
// auto-expand the enclosing collapsed <details> on fragment navigation.
function memberLine(modelId: string, label: string, members: Member[]) {
  const kind = memberKind(label)
  return members.length
    ? `**${label}:** ${members
        .map(m => `[${m.name}](../${modelId}#${kind}-${m.name.toLowerCase()})`)
        .join(', ')}`
    : ''
}

// A compact, single-page overview of every member reachable through
// composition, grouped by the model that defines it, so a reader does not have
// to traverse the whole inheritance chain to learn what is available.
function inheritedSection(ancestors: ModelWithHeader[]) {
  const blocks = ancestors.flatMap(model => {
    const id = model.header.id
    const lines = [
      memberLine(id, 'Properties', model.properties),
      memberLine(id, 'Volatiles', model.volatiles),
      memberLine(id, 'Getters', model.getters),
      memberLine(id, 'Methods', model.methods),
      memberLine(id, 'Actions', model.actions),
    ].filter(Boolean)
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

function renderModel(
  {
    header,
    properties,
    volatiles,
    getters,
    methods,
    actions,
    filename,
  }: ModelWithHeader,
  ancestors: ModelWithHeader[],
): string {
  const sections = section(
    memberSection(header.name, 'Properties', properties, p =>
      codeBlock('// type signature', p.signature, '// code', p.code),
    ),
    memberSection(header.name, 'Volatiles', volatiles, v =>
      codeBlock('// type signature', v.signature, '// code', v.code),
    ),
    memberSection(header.name, 'Getters', getters, g =>
      codeBlock('// type', g.signature),
    ),
    memberSection(header.name, 'Methods', methods, m =>
      codeBlock('// type signature', `${m.name}: ${m.signature}`),
    ),
    memberSection(header.name, 'Actions', actions, a =>
      codeBlock('// type signature', `${a.name}: ${a.signature}`),
    ),
  )

  const exSection = exampleSection(header.examples)
  const docsSection = overviewSection(
    header.docs,
    inheritedSection(ancestors),
    sections,
  )

  const category = stateModelCategory(header.name, header.category)
  return docPage({
    id: header.id,
    title: header.name,
    sidebarLabel: `${category} -> ${header.name}`,
    notes: `Note: this document is automatically generated from @jbrowse/mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag`,
    sourcePath: filename,
    githubDocPath: `website/docs/models/${header.name}.md`,
    body: section(exSection, docsSection),
  })
}

function memberSection(
  modelName: string,
  label: string,
  members: Member[],
  renderBody: (m: Member) => string,
) {
  const kind = memberKind(label)
  return members.length
    ? collapsible(
        `${modelName} - ${label}`,
        ...members.map(m =>
          section(
            `#### ${kind}: ${m.name}`,
            m.docs,
            renderBody(m),
            exampleSection(m.examples, '**Example:**'),
          ),
        ),
      )
    : ''
}

export async function writeModelDocs(byFile: Record<string, StateModel>) {
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
      renderModel(model, ancestors),
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
