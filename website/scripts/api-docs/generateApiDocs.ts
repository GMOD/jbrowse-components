import fs from 'fs'

import slugify from 'slugify'

import { writeDoc, writePage } from './format.ts'
import {
  codeBlock,
  exampleSection,
  parseTaggedComment,
  repoRelative,
  section,
} from './util.ts'

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

Auto-generated from exported functions tagged \`#api\` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

${section(...sorted.map(exp => renderExport(exp, '##')))}
`
}

export function writeApiDocs(byGroup: Record<string, ApiGroup>) {
  const dir = 'website/docs/api'
  fs.mkdirSync(dir, { recursive: true })
  for (const grp of Object.values(byGroup)) {
    writePage(`${dir}/${grp.id}.md`, renderGroup(grp))
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

const BLOCK_RE = new RegExp(`${README_START}[\\s\\S]*?${README_END}`)

// Mirror each package's `#api` exports into its README, between managed markers
// so regeneration is idempotent and never touches hand-written README prose. The
// block is appended once (replaced in place thereafter). Packages without a
// README get a minimal one seeded from package.json so the block has a home.
//
// A README that already carries the markers but whose package no longer exports
// anything `#api`-tagged has its block removed rather than left behind: nothing
// else would ever revisit that file, so dropping the last tag off a package
// would otherwise leave its README documenting exports that no longer exist,
// with no diff and no warning to say so.
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
    const existing = fs.existsSync(readmePath)
      ? fs.readFileSync(readmePath, 'utf8')
      : seedReadme(root)
    const block = `${README_START}\n\n${renderReadmeSection(exports)}\n\n${README_END}`
    writeDoc(
      readmePath,
      BLOCK_RE.test(existing)
        ? // A function replacer, because the block is rendered JSDoc prose,
          // type signatures and `#example` code: a `$&` or `$'` anywhere in
          // that (an example calling `String.replace`, a template-literal type)
          // is a replacement pattern to `String.replace`, and would splice the
          // README's own text into the API section instead of appearing.
          existing.replace(BLOCK_RE, () => block)
        : `${existing.trimEnd()}\n\n${block}\n`,
    )
  }
  for (const readmePath of readmesWithApiBlock()) {
    if (!byPackage[readmePath.replace(/\/README\.md$/, '')]) {
      const existing = fs.readFileSync(readmePath, 'utf8')
      writeDoc(readmePath, `${existing.replace(BLOCK_RE, '').trimEnd()}\n`)
    }
  }
}

// Every `<workspace>/<name>/README.md` already carrying the managed block.
function readmesWithApiBlock() {
  return ['packages', 'plugins', 'products'].flatMap(workspace =>
    fs
      .readdirSync(workspace, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => `${workspace}/${e.name}/README.md`)
      .filter(
        p =>
          fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(README_START),
      ),
  )
}
