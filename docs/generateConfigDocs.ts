import fs from 'fs'

import slugify from 'slugify'

import {
  extractWithComment,
  getAllFiles,
  parseTaggedComment,
  removeComments,
} from './util.ts'

import type { ExtractedNode } from './util.ts'

interface Item {
  name: string
  docs: string
  code: string
}
interface ConfigHeader {
  name: string
  docs: string
  id: string
}
interface Config {
  header?: ConfigHeader
  derives?: Item
  identifier?: Item
  preProcess?: Item
  slots: Item[]
  filename: string
}

function buildItem(obj: ExtractedNode): Item {
  const { name, docs } = parseTaggedComment(obj.comment, obj.type, obj.name)
  return { name, docs, code: removeComments(obj.node) }
}

function generateConfigDocs(files: string[]) {
  const cwd = `${process.cwd()}/`
  const byFile: Record<string, Config> = {}
  extractWithComment(files, obj => {
    const fn = obj.filename
    byFile[fn] ??= { slots: [], filename: fn.replace(cwd, '') }
    const file = byFile[fn]
    const item = buildItem(obj)

    if (obj.type === 'config') {
      file.header = {
        name: item.name,
        docs: item.docs,
        id: slugify(item.name, { lower: true }),
      }
    } else if (obj.type === 'baseConfiguration') {
      file.derives = item
    } else if (obj.type === 'identifier') {
      file.identifier = item
    } else if (obj.type === 'preProcessSnapshot') {
      file.preProcess = item
    } else if (obj.type === 'slot') {
      file.slots.push(item)
    }
  })
  return byFile
}

function renderConfig({
  header,
  derives,
  identifier,
  preProcess,
  slots,
  filename,
}: Config): string | undefined {
  if (!header) {
    return undefined
  }
  const sections = [
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
    derives &&
      section(
        `### ${header.name} - Derives from`,
        derives.docs,
        codeBlock(derives.code),
      ),
  ]
    .filter(Boolean)
    .join('\n\n')

  return `---
id: ${header.id}
title: ${header.name}
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${filename})

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/${header.name}.md)

## Docs

${header.docs}

${sections}
`
}

function slotBlock({ name, docs, code }: Item) {
  return section(`#### slot: ${name}`, docs, codeBlock(code))
}

function codeBlock(body: string) {
  return ['```js', body, '```'].join('\n')
}

function section(...parts: (string | false | 0 | undefined)[]) {
  return parts.filter(Boolean).join('\n\n')
}

export default async function main() {
  const dir = 'website/docs/config'
  fs.mkdirSync(dir, { recursive: true })
  const configs = generateConfigDocs(await getAllFiles())
  for (const cfg of Object.values(configs)) {
    const rendered = renderConfig(cfg)
    if (rendered && cfg.header) {
      fs.writeFileSync(`${dir}/${cfg.header.name}.md`, rendered)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
