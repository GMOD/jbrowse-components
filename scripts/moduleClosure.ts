import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

import ts from 'typescript'

// Measures the module graph reachable from an entry file: how many files, and
// how many lines, a module would have to bring with it to move into a package
// of its own. `agent-docs/ideas/barrels-block-extraction.md` is the writeup.
//
// The runtime closure follows only edges that survive to JS; the type closure
// follows every import. Both matter for extraction — a type closure reaching
// the session family is what stops a coordinate utility from leaving.

// Walk up from the cwd rather than from the module's own path: jest compiles
// this to CJS, where `import.meta` is a syntax error, and the closure test
// imports it.
function findRepoRoot(from: string): string {
  return existsSync(join(from, 'pnpm-workspace.yaml'))
    ? from
    : findRepoRoot(dirname(from))
}

const root = findRepoRoot(process.cwd())

const configPath = join(root, 'tsconfig.json')
const config = ts.parseJsonConfigFileContent(
  ts.readConfigFile(configPath, ts.sys.readFile).config,
  ts.sys,
  root,
)

const host: ts.ModuleResolutionHost = ts.sys

interface Edge {
  specifier: string
  typeOnly: boolean
}

const sourceCache = new Map<string, ts.SourceFile>()

function parse(file: string) {
  const cached = sourceCache.get(file)
  if (cached) {
    return cached
  }
  const parsed = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
  )
  sourceCache.set(file, parsed)
  return parsed
}

function allSpecifiersAreTypes(
  clause: ts.NamedImportBindings | ts.NamedExportBindings | undefined,
) {
  return (
    clause !== undefined &&
    (ts.isNamedImports(clause) || ts.isNamedExports(clause)) &&
    clause.elements.length > 0 &&
    clause.elements.every(el => el.isTypeOnly)
  )
}

function edgesOf(file: string) {
  const source = parse(file)
  const edges: Edge[] = []
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const clause = statement.importClause
      edges.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly:
          clause !== undefined &&
          (clause.isTypeOnly || allSpecifiersAreTypes(clause.namedBindings)),
      })
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      edges.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly:
          statement.isTypeOnly || allSpecifiersAreTypes(statement.exportClause),
      })
    }
  }
  return edges
}

function resolve(specifier: string, containingFile: string) {
  const resolved = ts.resolveModuleName(
    specifier,
    containingFile,
    config.options,
    host,
  ).resolvedModule
  return resolved?.resolvedFileName
}

// pnpm resolves a workspace package to its real path under `packages/`, so an
// in-repo target is anything under the repo root that is not a node_modules
// store entry.
function isInRepoSource(file: string) {
  return file.startsWith(root) && !file.includes('/node_modules/')
}

export function closure(entry: string, includeTypes: boolean) {
  const seen = new Set<string>([entry])
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    for (const edge of edgesOf(file)) {
      if (includeTypes || !edge.typeOnly) {
        const target = resolve(edge.specifier, file)
        if (target && isInRepoSource(target) && !seen.has(target)) {
          seen.add(target)
          queue.push(target)
        }
      }
    }
  }
  const lines = [...seen].reduce(
    (total, file) => total + parse(file).getLineStarts().length,
    0,
  )
  return { files: seen, lines }
}

export const ENTRIES = [
  'packages/display-kit/src/fetchEachRegion.ts',
  'packages/display-kit/src/FetchMixin.ts',
  'packages/display-kit/src/installPerRegionFetchAutoruns.ts',
  'packages/display-kit/src/MultiRegionDisplayMixin.ts',
  'packages/core/src/util/locString.ts',
  'packages/core/src/util/bpUtils.ts',
  'packages/core/src/util/assemblyConfigUtils.ts',
  'packages/core/src/util/installFetch.ts',
  'packages/core/src/util/fetchContext.ts',
  'packages/core/src/util/installInitAutorun.ts',
  'packages/core/src/ui/MenuTypes.ts',
  'packages/core/src/ui/menuItems.ts',
  'packages/core/src/ui/legendSpec.ts',
]

if (process.argv[1]?.endsWith('moduleClosure.ts')) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const entries = args.filter(a => !a.startsWith('--'))
  const rows = (entries.length > 0 ? entries : ENTRIES).map(entry => {
    const file = join(root, entry)
    const runtime = closure(file, false)
    const types = closure(file, true)
    return {
      entry: relative(root, file),
      runtimeFiles: runtime.files.size,
      runtimeLines: runtime.lines,
      typeFiles: types.files.size,
      typeLines: types.lines,
    }
  })
  if (json) {
    console.log(JSON.stringify(rows, null, 2))
  } else {
    const width = Math.max(...rows.map(r => r.entry.length))
    console.log(
      `${'entry'.padEnd(width)}  runtime files  runtime lines  type files  type lines`,
    )
    for (const r of rows) {
      console.log(
        [
          r.entry.padEnd(width),
          String(r.runtimeFiles).padStart(13),
          String(r.runtimeLines).padStart(13),
          String(r.typeFiles).padStart(10),
          String(r.typeLines).padStart(10),
        ].join('  '),
      )
    }
  }
}
