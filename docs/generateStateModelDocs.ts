import fs from 'fs'

import slugify from 'slugify'

import {
  extractWithComment,
  getAllFiles,
  parseTaggedComment,
  removeComments,
} from './util.ts'

import type { ExtractedNode } from './util.ts'

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
interface StateModel {
  header?: ModelHeader
  properties: Member[]
  getters: Member[]
  methods: Member[]
  actions: Member[]
  filename: string
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

function generateStateModelDocs(files: string[]) {
  const cwd = `${process.cwd()}/`
  const byFile: Record<string, StateModel> = {}
  extractWithComment(files, obj => {
    const fn = obj.filename
    byFile[fn] ??= {
      properties: [],
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
    } else if (obj.type === 'getter') {
      file.getters.push(member)
    } else if (obj.type === 'method') {
      file.methods.push(member)
    } else if (obj.type === 'action') {
      file.actions.push(member)
    }
  })
  return byFile
}

function renderModel({
  header,
  properties,
  getters,
  methods,
  actions,
  filename,
}: StateModel): string | undefined {
  if (!header) {
    return undefined
  }
  const sections = [
    memberSection(header.name, 'Properties', properties, p =>
      codeBlock('// type signature', p.signature, '// code', p.code),
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
  ]
    .filter(Boolean)
    .join('\n\n')

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

${header.docs}

${sections}
`
}

function memberSection(
  modelName: string,
  label: string,
  members: Member[],
  renderBody: (m: Member) => string,
) {
  if (!members.length) {
    return ''
  }
  const kind = label.toLowerCase().replace(/s$/, '')
  const blocks = members.map(m =>
    [`#### ${kind}: ${m.name}`, m.docs, renderBody(m)].join('\n\n'),
  )
  return [`### ${modelName} - ${label}`, ...blocks].join('\n\n')
}

function codeBlock(...lines: string[]) {
  return ['```js', ...lines, '```'].join('\n')
}

export default async function main() {
  const dir = 'website/docs/models'
  fs.mkdirSync(dir, { recursive: true })
  const models = generateStateModelDocs(await getAllFiles())
  for (const model of Object.values(models)) {
    const rendered = renderModel(model)
    if (rendered && model.header) {
      fs.writeFileSync(`${dir}/${model.header.name}.md`, rendered)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
