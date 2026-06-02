import fs from 'fs'

import slugify from 'slugify'

import {
  codeBlock,
  parseExtends,
  parseTaggedComment,
  removeComments,
  section,
} from './util.ts'

import type { ExtendsRef, ExtractedNode } from './util.ts'

interface Member {
  name: string
  docs: string
  code: string
  signature: string
}
interface ModelHeader {
  name: string
  id: string
  docs: string
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
  ref: ExtendsRef
  model?: ModelWithHeader
}

function buildMember(obj: ExtractedNode): Member {
  const { name, docs } = parseTaggedComment(obj.comment, obj.type, obj.name)
  return {
    name,
    docs,
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
      docs: member.docs,
      id: slugify(member.name, { lower: true }),
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

// Walk the extends graph transitively, depth-first, deduping by slug and
// guarding cycles. Returns ancestors in reading order (direct parents first,
// then their parents). An unresolved slug yields an entry with model undefined.
function collectAncestors(
  model: StateModel,
  bySlug: Map<string, ModelWithHeader>,
  seen = new Set<string>(),
): Ancestor[] {
  const out: Ancestor[] = []
  for (const ref of parseExtends(model.header?.docs ?? '')) {
    if (!seen.has(ref.slug)) {
      seen.add(ref.slug)
      const parent = bySlug.get(ref.slug)
      out.push({ ref, model: parent })
      if (parent) {
        out.push(...collectAncestors(parent, bySlug, seen))
      }
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
    const lines = model
      ? [
          memberLine('Properties', model.properties),
          memberLine('Volatiles', model.volatiles),
          memberLine('Getters', model.getters),
          memberLine('Methods', model.methods),
          memberLine('Actions', model.actions),
        ].filter(Boolean)
      : []
    return model && lines.length
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

## Docs

${section(header.docs, inheritedSection(ancestors), sections)}
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
          section(`#### ${kind}: ${m.name}`, m.docs, renderBody(m)),
        ),
      )
    : ''
}

function validateLinks(model: ModelWithHeader, ancestors: Ancestor[]) {
  for (const { ref, model: parent } of ancestors) {
    if (!parent) {
      console.warn(
        `${model.header.name}: extends link "[${ref.name}](../${ref.slug})" does not resolve to a generated model page`,
      )
    }
  }
}

export function writeModelDocs(byFile: Record<string, StateModel>) {
  const dir = 'website/docs/models'
  fs.mkdirSync(dir, { recursive: true })
  const withHeader = Object.values(byFile).filter((m): m is ModelWithHeader =>
    Boolean(m.header),
  )
  const bySlug = new Map(withHeader.map(m => [m.header.id, m] as const))
  for (const model of withHeader) {
    const ancestors = collectAncestors(model, bySlug)
    validateLinks(model, ancestors)
    fs.writeFileSync(
      `${dir}/${model.header.name}.md`,
      renderModel(model, ancestors),
    )
  }
}
