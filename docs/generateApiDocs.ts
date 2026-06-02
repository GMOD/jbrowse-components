import fs from 'fs'

import slugify from 'slugify'

import { codeBlock, parseTaggedComment, section } from './util.ts'

import type { ExtractedNode } from './util.ts'

interface ApiExport {
  name: string
  docs: string
  signature: string
  filename: string
}
export interface ApiGroup {
  group: string
  id: string
  exports: ApiExport[]
}

const cwd = `${process.cwd()}/`

// `#api` with no explicit group name falls back to the source file's directory,
// e.g. packages/core/src/util/index.ts -> "util". Files named index.* take the
// directory; otherwise the file's own basename is used.
function groupFromFilename(filename: string) {
  const parts = filename.replace(cwd, '').split('/')
  const file = parts.at(-1) ?? ''
  const dir = parts.at(-2) ?? 'api'
  return file.startsWith('index.') ? dir : file.replace(/\.[tj]sx?$/, '')
}

function groupId(group: string) {
  return slugify(group.replaceAll('/', '-'), { lower: true })
}

// Route one extracted node into its API-group bucket. Unlike the config and
// state-model accumulators, many `#api` exports can share one group/page, so
// these append rather than overwrite. The empty-name match that the extractor
// also emits for the parent VariableStatement is dropped via `!obj.name`.
export function accumulateApi(
  byGroup: Record<string, ApiGroup>,
  obj: ExtractedNode,
) {
  if (obj.type === 'api' && obj.name) {
    const { name: explicitGroup, docs } = parseTaggedComment(
      obj.comment,
      'api',
      '',
    )
    const group = explicitGroup || groupFromFilename(obj.filename)
    const id = groupId(group)
    byGroup[id] ??= { group, id, exports: [] }
    byGroup[id].exports.push({
      name: obj.name,
      docs,
      signature: obj.signature,
      filename: obj.filename.replace(cwd, ''),
    })
  }
}

function renderExport({ name, docs, signature, filename }: ApiExport) {
  return section(
    `### ${name}`,
    docs,
    signature && codeBlock('// type signature', signature),
    `[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${filename})`,
  )
}

function renderGroup({ group, id, exports }: ApiGroup) {
  const sorted = [...exports].sort((a, b) => a.name.localeCompare(b.name))
  return `---
id: ${id}
title: ${group}
---

Note: this document is automatically generated from exported functions marked
with an \`#api\` JSDoc tag in our source code. See [Plugin dependencies and
re-exports](/docs/developer_guides/imports_and_reexports) for how to import
these from a plugin.

${section(...sorted.map(renderExport))}
`
}

export function writeApiDocs(byGroup: Record<string, ApiGroup>) {
  const dir = 'website/docs/api'
  fs.mkdirSync(dir, { recursive: true })
  for (const grp of Object.values(byGroup)) {
    fs.writeFileSync(`${dir}/${grp.id}.md`, renderGroup(grp))
  }
}

// The monorepo package a source file belongs to, e.g.
// packages/core/src/util/mstUtils.ts -> packages/core
function packageRoot(filename: string) {
  const [workspace, name] = filename.split('/')
  return workspace &&
    name &&
    ['packages', 'plugins', 'products'].includes(workspace)
    ? `${workspace}/${name}`
    : undefined
}

const README_START = '<!-- API_DOCS_START -->'
const README_END = '<!-- API_DOCS_END -->'

function renderReadmeSection(exports: ApiExport[]) {
  const sorted = [...exports].sort((a, b) => a.name.localeCompare(b.name))
  return section(
    '## API',
    'Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.',
    ...sorted.map(renderExport),
  )
}

// Mirror each package's `#api` exports into its README, between managed markers
// so regeneration is idempotent and never touches hand-written README prose. If
// the markers are absent the block is appended once; thereafter it is replaced
// in place. Packages without a README are skipped with a warning.
export function writeApiReadmes(byGroup: Record<string, ApiGroup>) {
  const byPackage: Record<string, ApiExport[]> = {}
  for (const grp of Object.values(byGroup)) {
    for (const exp of grp.exports) {
      const root = packageRoot(exp.filename)
      if (root) {
        ;(byPackage[root] ??= []).push(exp)
      }
    }
  }
  for (const [root, exports] of Object.entries(byPackage)) {
    const readmePath = `${root}/README.md`
    if (fs.existsSync(readmePath)) {
      const block = `${README_START}\n\n${renderReadmeSection(exports)}\n\n${README_END}`
      const existing = fs.readFileSync(readmePath, 'utf8')
      const re = new RegExp(`${README_START}[\\s\\S]*?${README_END}`)
      fs.writeFileSync(
        readmePath,
        re.test(existing)
          ? existing.replace(re, block)
          : `${existing.trimEnd()}\n\n${block}\n`,
      )
    } else {
      console.warn(`no README at ${readmePath}, skipping API injection`)
    }
  }
}
