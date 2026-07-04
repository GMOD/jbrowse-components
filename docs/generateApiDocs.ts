import fs from 'fs'

import slugify from 'slugify'

import {
  codeBlock,
  exampleSection,
  parseTaggedComment,
  repoRelative,
  section,
} from './util.ts'
import { writeFormatted } from './format.ts'

import type { Example, ExtractedNode } from './util.ts'

interface ApiExport {
  name: string
  docs: string
  examples: Example[]
  signature: string
  filename: string
}
export interface ApiGroup {
  group: string
  id: string
  exports: ApiExport[]
}

// `#api` with no explicit group name defaults to the package the file lives in,
// e.g. packages/cigar-utils/src/mismatchParser.ts -> "cigar-utils", so a bare
// `#api` groups every tagged export in a package onto one page. Pass a name
// (`#api core/util`) to split a package across finer-grained pages.
function groupFromFilename(filename: string) {
  const relative = repoRelative(filename)
  const root = packageRoot(relative)
  return root?.split('/').at(-1) ?? relative.split('/').at(-2) ?? 'api'
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
    const {
      name: explicitGroup,
      docs,
      examples,
    } = parseTaggedComment(obj.comment, 'api', '')
    const group = explicitGroup || groupFromFilename(obj.filename)
    const id = groupId(group)
    byGroup[id] ??= { group, id, exports: [] }
    byGroup[id].exports.push({
      name: obj.name,
      docs,
      examples,
      signature: obj.signature,
      filename: repoRelative(obj.filename),
    })
  }
}

// `heading` is the markdown prefix for the export's name. Standalone doc pages
// render exports as top-level `##` sections; the README nests them under its
// own `## API` heading, so there they render one level deeper as `###`.
function renderExport(
  { name, docs, examples, signature, filename }: ApiExport,
  heading = '###',
) {
  return section(
    `${heading} ${name}`,
    docs,
    signature && codeBlock('// type signature', signature),
    exampleSection(examples, `${heading}# Example usage`),
    `[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${filename})`,
  )
}

function sortByName(exports: ApiExport[]) {
  return [...exports].sort((a, b) => a.name.localeCompare(b.name))
}

function renderGroup({ group, id, exports }: ApiGroup) {
  const sorted = sortByName(exports)
  return `---
id: ${id}
title: ${group}
---

Note: this document is automatically generated from exported functions marked
with an \`#api\` JSDoc tag in our source code. See [Plugin dependencies and
re-exports](/docs/developer_guides/imports_and_reexports) for how to import
these from a plugin.

${section(...sorted.map(exp => renderExport(exp, '##')))}
`
}

export async function writeApiDocs(byGroup: Record<string, ApiGroup>) {
  const dir = 'website/docs/api'
  fs.mkdirSync(dir, { recursive: true })
  for (const grp of Object.values(byGroup)) {
    await writeFormatted(`${dir}/${grp.id}.md`, renderGroup(grp))
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
  const sorted = sortByName(exports)
  return section(
    '## API',
    'Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.',
    ...sorted.map(exp => renderExport(exp)),
  )
}

// A minimal README seeded from package.json for packages that have `#api`
// exports but no README yet, so the API block has somewhere to live.
function seedReadme(root: string) {
  const pkgPath = `${root}/package.json`
  const { name, description } = JSON.parse(
    fs.readFileSync(pkgPath, 'utf8'),
  ) as { name?: string; description?: string }
  return section(`# ${name ?? root}`, description) + '\n'
}

// Mirror each package's `#api` exports into its README, between managed markers
// so regeneration is idempotent and never touches hand-written README prose. The
// block is appended once (replaced in place thereafter). Packages without a
// README get a minimal one seeded from package.json so the block has a home.
export async function writeApiReadmes(byGroup: Record<string, ApiGroup>) {
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
    const existing = fs.existsSync(readmePath)
      ? fs.readFileSync(readmePath, 'utf8')
      : seedReadme(root)
    const block = `${README_START}\n\n${renderReadmeSection(exports)}\n\n${README_END}`
    const re = new RegExp(`${README_START}[\\s\\S]*?${README_END}`)
    await writeFormatted(
      readmePath,
      re.test(existing)
        ? existing.replace(re, block)
        : `${existing.trimEnd()}\n\n${block}\n`,
    )
  }
}
