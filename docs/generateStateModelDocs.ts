import fs from 'fs'

import slugify from 'slugify'

import {
  codeBlock,
  exampleSection,
  overviewSection,
  parseTaggedComment,
  removeComments,
  section,
  stripComposedBlock,
} from './util.ts'

import type { ComposedRef, Example, ExtractedNode } from './util.ts'

interface Member {
  name: string
  docs: string
  examples: Example[]
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
interface Ancestor {
  model: ModelWithHeader
}
interface ModelIndex {
  byDeclId: Map<string, ModelWithHeader>
  bySlug: Map<string, ModelWithHeader>
}

function buildMember(obj: ExtractedNode): Member {
  const { name, docs, examples } = parseTaggedComment(
    obj.comment,
    obj.type,
    obj.name,
  )
  return {
    name,
    docs,
    examples,
    code: removeComments(obj.node),
    signature: obj.signature,
  }
}

const cwd = `${process.cwd()}/`

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
    filename: fn.replace(cwd, ''),
  }
  const file = byFile[fn]
  const member = buildMember(obj)

  if (obj.type === 'stateModel') {
    file.header = {
      name: member.name,
      docs: stripComposedBlock(member.docs),
      examples: member.examples,
      id: slugify(member.name, { lower: true }),
      selfDeclId: obj.selfDeclId,
      composedOf: obj.composedOf ?? [],
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

// Walk the composition graph transitively, depth-first, deduping by declId and
// guarding cycles. Returns ancestors in reading order (direct parents first,
// then their parents). Composed models that aren't documented #stateModels
// (plain types.model mixins, config bases) resolve to nothing and are skipped —
// they contribute no member section.
function collectAncestors(
  model: ModelWithHeader,
  index: ModelIndex,
  seen = new Set<string>(),
): Ancestor[] {
  const out: Ancestor[] = []
  for (const ref of model.header.composedOf) {
    const parent =
      (ref.declId ? index.byDeclId.get(ref.declId) : undefined) ??
      (ref.name
        ? index.bySlug.get(slugify(ref.name, { lower: true }))
        : undefined)
    if (parent && !seen.has(parent.header.id)) {
      seen.add(parent.header.id)
      out.push({ model: parent })
      out.push(...collectAncestors(parent, index, seen))
    }
  }
  return out
}

function memberLine(label: string, members: Member[]) {
  return members.length
    ? `**${label}:** ${members.map(m => m.name).join(', ')}`
    : ''
}

// A compact, single-page overview of every member reachable through
// composition, grouped by the model that defines it, so a reader does not have
// to traverse the whole inheritance chain to learn what is available.
function inheritedSection(ancestors: Ancestor[]) {
  const blocks = ancestors.flatMap(({ model }) => {
    const lines = [
      memberLine('Properties', model.properties),
      memberLine('Volatiles', model.volatiles),
      memberLine('Getters', model.getters),
      memberLine('Methods', model.methods),
      memberLine('Actions', model.actions),
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
  ancestors: Ancestor[],
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

  return `---
id: ${header.id}
title: ${header.name}
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${filename})

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/${header.name}.md)

${section(exSection, docsSection)}
`
}

function memberSection(
  modelName: string,
  label: string,
  members: Member[],
  renderBody: (m: Member) => string,
) {
  const kind = label.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')
  return members.length
    ? section(
        `### ${modelName} - ${label}`,
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

export function writeModelDocs(byFile: Record<string, StateModel>) {
  const dir = 'website/docs/models'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = Object.values(byFile).filter((m): m is ModelWithHeader =>
    Boolean(m.header),
  )
  const index: ModelIndex = {
    byDeclId: new Map(
      withHeader
        .filter(m => m.header.selfDeclId)
        .map(m => [m.header.selfDeclId!, m] as const),
    ),
    bySlug: new Map(withHeader.map(m => [m.header.id, m] as const)),
  }
  for (const model of withHeader) {
    const ancestors = collectAncestors(model, index)
    fs.writeFileSync(
      `${dir}/${model.header.name}.md`,
      renderModel(model, ancestors),
    )
  }
  const noExample = withHeader.filter(m => !m.header.examples.length)
  if (noExample.length) {
    console.warn(
      `${noExample.length}/${withHeader.length} models have no #example: ${noExample.map(m => m.header.name).join(', ')}`,
    )
  }
}
