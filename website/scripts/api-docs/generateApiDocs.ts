import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import slugify from 'slugify'

import { oxfmtBin } from '../check-utils.ts'
import { repoRoot } from '../paths.ts'
import { symbolDeclId } from './docProgram.ts'
import { writeDoc, writePage } from './format.ts'
import { parseTaggedComment } from './jsDocTags.ts'
import { codeBlock, exampleSection, section } from './markdown.ts'
import { repoRelative } from './util.ts'

import type { ExtractedNode } from './docProgram.ts'
import type { Example } from './jsDocTags.ts'
import type * as ts from 'typescript'

interface ApiExport {
  name: string
  docs: string
  examples: Example[]
  signature: string
  declaresType: boolean
  importAs?: { specifier: string; name: string }
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
// these append rather than overwrite.
export function accumulateApi(
  byGroup: Record<string, ApiGroup>,
  obj: ExtractedNode,
  program: ts.Program,
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
    if (byGroup[id].group !== group) {
      throw new Error(
        `${repoRelative(obj.filename)}: #api group "${group}" and "${byGroup[id].group}" both render to website/docs/api/${id}.md — rename one`,
      )
    }
    byGroup[id].exports.push({
      name: obj.name,
      docs,
      examples,
      signature: obj.signature,
      declaresType: !!obj.declaresType,
      importAs: importSpecifier(program, obj),
      filename: repoRelative(obj.filename),
    })
  }
}

// `heading` is the markdown prefix for the export's name. Standalone doc pages
// render exports as top-level `##` sections; the README nests them under its
// own `## API` heading, so there they render one level deeper as `###`.
function renderExport(exp: ApiExport, heading = '###') {
  const { name, docs, examples, signature, declaresType, importAs, filename } =
    exp
  const root = packageRoot(filename)
  return section(
    `${heading} ${name}`,
    docs,
    signature &&
      codeBlock(
        importAs
          ? `import ${declaresType ? 'type ' : ''}{ ${importAs.name} } from '${importAs.specifier}'`
          : `// no entry point of ${(root && packageManifest(root).name) ?? 'its package'} exports it`,
        '',
        formattedDeclaration(declarationSource(exp)),
      ),
    exampleSection(examples, `${heading}# Example usage`),
    `[Source code](https://github.com/GMOD/jbrowse-components/blob/main/${filename})`,
  )
}

function declarationSource({
  name,
  signature,
  declaresType,
  importAs,
}: ApiExport) {
  return declaresType
    ? signature
    : declarations(importAs?.name ?? name, signature)
}

const BLOCK_SEPARATOR = '// @api-declaration'
const formatted = new Map<string, string>()

// Each declaration as the repo formatter prints it, so a long signature wraps
// one parameter or member per line, the same on the page as in the README
// (whose own formatting pass then leaves it alone). One formatter process takes
// every declaration a run has not formatted yet; if that batch does not parse,
// each is formatted alone, and one that still does not parse stays as printed.
// `const x: T` has no initializer, so it is formatted as `declare const`.
export function formatDeclarations(sources: string[]) {
  const pending = [...new Set(sources)].filter(s => !formatted.has(s))
  const parts = pending.length
    ? formatTypeScript(
        pending.map(asStatement).join(`\n${BLOCK_SEPARATOR}\n`),
      )?.split(`\n${BLOCK_SEPARATOR}\n`)
    : []
  for (const [i, source] of pending.entries()) {
    const part =
      parts?.length === pending.length
        ? parts[i]
        : formatTypeScript(asStatement(source))
    formatted.set(
      source,
      part ? part.trim().replaceAll(/^declare const /gm, 'const ') : source,
    )
  }
  return sources.map(formattedDeclaration)
}

function formattedDeclaration(source: string) {
  return formatted.get(source) ?? source
}

function asStatement(declaration: string) {
  return declaration.replaceAll(/^const /gm, 'declare const ')
}

function formatTypeScript(text: string) {
  const { status, stdout } = spawnSync(
    oxfmtBin(),
    ['--stdin-filepath=declaration.ts'],
    { input: text, encoding: 'utf8', cwd: repoRoot, maxBuffer: 64 << 20 },
  )
  return status === 0 ? stdout : undefined
}

// A value's signature as the statements declaring it, one per overload:
// `function f(a: A): R` for a function type, else `const f: T`. An arrow type
// on its own is an expression statement to a formatter, which prefixes it
// with `;` in a README.
export function declarations(name: string, signature: string) {
  return signature
    .split('\n')
    .map(line => {
      const sig = nameBindingPatterns(line)
      const fn = splitArrow(sig)
      return fn
        ? `function ${name}${fn.parameters}: ${fn.returns}`
        : `const ${name}: ${sig}`
    })
    .join('\n')
}

function splitArrow(sig: string) {
  const parametersStart = sig.startsWith('<') ? closingIndex(sig, 0) + 1 : 0
  const parametersEnd =
    sig[parametersStart] === '(' ? closingIndex(sig, parametersStart) : -1
  return parametersEnd > 0 && sig.startsWith(' => ', parametersEnd + 1)
    ? {
        parameters: sig.slice(0, parametersEnd + 1),
        returns: sig.slice(parametersEnd + 5),
      }
    : undefined
}

const PARAMETER_NAMES = ['opts', 'args', 'params']

// A destructured parameter printed as its pattern repeats every key its type
// spells out again (`({ a, b }: { a: A; b: B })`), so it reads as a named
// parameter instead: `(opts: { a: A; b: B })`.
export function nameBindingPatterns(sig: string) {
  const taken = new Set(
    PARAMETER_NAMES.filter(n => new RegExp(`[(,] ?${n}\\??:`).test(sig)),
  )
  let out = ''
  for (let i = 0; i < sig.length; i++) {
    const end =
      sig[i] === '{' && (out.endsWith('(') || out.endsWith(', '))
        ? closingIndex(sig, i)
        : -1
    const name =
      end > 0 && /^\??:/.test(sig.slice(end + 1, end + 3))
        ? PARAMETER_NAMES.find(n => !taken.has(n))
        : undefined
    if (name) {
      taken.add(name)
      out += name
      i = end
    } else {
      out += sig[i]
    }
  }
  return out
}

// The index of the bracket closing the one at `open`, counting every bracket
// kind; the `>` of a `=>` closes nothing, and a quoted string is skipped whole.
function closingIndex(sig: string, open: number) {
  let depth = 0
  for (let i = open; i < sig.length; i++) {
    const c = sig.charAt(i)
    if (c === '"' || c === "'" || c === '`') {
      i = closingQuote(sig, i)
    } else if ('<{(['.includes(c)) {
      depth++
    } else if ('>})]'.includes(c) && !(c === '>' && sig[i - 1] === '=')) {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

function closingQuote(sig: string, open: number) {
  let i = open + 1
  while (i < sig.length && sig[i] !== sig[open]) {
    i += sig[i] === '\\' ? 2 : 1
  }
  return i
}

// The module a plugin imports an export from. A value the host serves comes
// from the shortest specifier of its own package that the re-export manifest
// lists it under (`@jbrowse/core/util`, not `@jbrowse/core/util/mstUtils`), so
// the plugin shares the host's copy. Anything else comes from the shortest
// entry of its package's `exports` map whose module exports this declaration
// under its own name, or failing that under another (`plainTrackControl` for
// the default-exported `PlainTrackControl`). Undefined for an export no entry
// point reaches.
function importSpecifier(
  program: ts.Program,
  { name, filename, declaresType, selfDeclId }: ExtractedNode,
) {
  const root = packageRoot(repoRelative(filename))
  const manifest = root ? packageManifest(root) : undefined
  const served =
    manifest && !declaresType ? servedSpecifier(name, manifest.name) : undefined
  return served
    ? { specifier: served, name }
    : manifest?.entrypoints
        .flatMap(({ specifier, file }) =>
          exportedNames(program, file, selfDeclId).map(exported => ({
            specifier,
            name: exported,
          })),
        )
        .sort(
          (a, b) =>
            Number(a.name !== name) - Number(b.name !== name) ||
            a.specifier.length - b.specifier.length,
        )[0]
}

function exportedNames(
  program: ts.Program,
  file: string,
  declId: string | undefined,
) {
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(file)
  const module = source && checker.getSymbolAtLocation(source)
  return (module ? checker.getExportsOfModule(module) : [])
    .filter(s => s.name !== 'default' && symbolDeclId(checker, s) === declId)
    .map(s => s.name)
}

function shortest(specifiers: string[]) {
  return specifiers.sort((a, b) => a.length - b.length)[0]
}

function servedSpecifier(name: string, pkg: string | undefined) {
  return shortest(
    (servedModules().get(name) ?? [])
      .filter(s => s.pkg === pkg)
      .map(s => s.specifier),
  )
}

const REEXPORTS = 'packages/core/src/ReExports/reExports.generated.json'
let servedModulesByName: ReturnType<typeof readServedModules> | undefined

function servedModules() {
  servedModulesByName ??= readServedModules()
  return servedModulesByName
}

function readServedModules() {
  const byName = new Map<string, { specifier: string; pkg: string }[]>()
  const modules = fields(
    fields(JSON.parse(fs.readFileSync(REEXPORTS, 'utf8'))).get('modules'),
  )
  for (const [specifier, module] of modules) {
    const entry = fields(module)
    const pkg = stringField(entry, 'package')
    const names = entry.get('names')
    if (pkg && Array.isArray(names)) {
      for (const n of names) {
        if (typeof n === 'string') {
          byName.set(n, [...(byName.get(n) ?? []), { specifier, pkg }])
        }
      }
    }
  }
  return byName
}

function fields(value: unknown) {
  return new Map<string, unknown>(
    typeof value === 'object' && value ? Object.entries(value) : [],
  )
}

function stringField(record: Map<string, unknown>, key: string) {
  const value = record.get(key)
  return typeof value === 'string' ? value : undefined
}

// A package's name and description, and each entry point a consumer imports as
// `<name><subpath>`: its `exports` map, or `main` as `.` without one.
function readPackageManifest(root: string) {
  const file = `${root}/package.json`
  const json = fields(
    fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {},
  )
  const name = stringField(json, 'name')
  const exportsMap = fields(json.get('exports'))
  const targets = exportsMap.size
    ? [...exportsMap].map(([subpath, target]) => ({ subpath, target }))
    : [{ subpath: '.', target: json.get('main') }]
  return {
    name,
    description: stringField(json, 'description'),
    entrypoints: targets.flatMap(({ subpath, target }) =>
      name && typeof target === 'string'
        ? [
            {
              specifier: `${name}${subpath.slice(1)}`,
              file: path.join(root, target),
            },
          ]
        : [],
    ),
  }
}

const manifests = new Map<string, ReturnType<typeof readPackageManifest>>()

function packageManifest(root: string) {
  const manifest = manifests.get(root) ?? readPackageManifest(root)
  manifests.set(root, manifest)
  return manifest
}

function sortByName(exports: ApiExport[]) {
  return [...exports].sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

// A page is titled by the package its exports come from, with an explicit
// group's remainder in parentheses (`core/util` -> `@jbrowse/core (util)`),
// and described by that package's manifest.
function groupHeading({ group, exports }: ApiGroup) {
  const root = exports[0] && packageRoot(exports[0].filename)
  const manifest = root ? packageManifest(root) : undefined
  const short = root?.split('/').at(-1)
  const rest =
    short && group.startsWith(`${short}/`) ? group.slice(short.length + 1) : ''
  const name = manifest?.name ?? group
  return {
    title: rest ? `${name} (${rest})` : name,
    description: manifest?.description,
  }
}

function renderGroup(grp: ApiGroup) {
  const { id, exports } = grp
  const { title, description } = groupHeading(grp)
  const sorted = sortByName(exports)
  return `---
id: ${id}
title: ${JSON.stringify(title)}
${description ? `description: ${JSON.stringify(description)}\n` : ''}---

Auto-generated from exported functions tagged \`#api\` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

${section(...sorted.map(exp => renderExport(exp, '##')))}
`
}

function formatGroups(byGroup: Record<string, ApiGroup>) {
  formatDeclarations(
    Object.values(byGroup).flatMap(g => g.exports.map(declarationSource)),
  )
}

export function writeApiDocs(byGroup: Record<string, ApiGroup>) {
  formatGroups(byGroup)
  const dir = 'website/docs/api'
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
  const { name, description } = packageManifest(root)
  return section(`# ${name ?? root}`, description) + '\n'
}

const BLOCK_RE = new RegExp(`${README_START}[\\s\\S]*?${README_END}`)

// Whether `text` holds the managed block. A second START or a START with no END
// is an error: BLOCK_RE replaces only the first pair, and a dangling START
// would get a fresh block appended under it.
function hasApiBlock(readmePath: string, text: string) {
  const starts = text.split(README_START).length - 1
  const ends = text.split(README_END).length - 1
  if (starts > 1 || starts !== ends || (starts && !BLOCK_RE.test(text))) {
    throw new Error(
      `${readmePath}: expected at most one ${README_START} … ${README_END} pair, found ${starts} start(s) and ${ends} end(s)`,
    )
  }
  return starts === 1
}

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
  formatGroups(byGroup)
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
      hasApiBlock(readmePath, existing)
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
        p => fs.existsSync(p) && hasApiBlock(p, fs.readFileSync(p, 'utf8')),
      ),
  )
}
