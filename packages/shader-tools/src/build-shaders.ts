#!/usr/bin/env node
/* eslint-disable no-console */
// Compiles every `*.slang` source file in the workspace into its matching
// `*.generated.ts` artifact. Emits WGSL + GLSL-ES-300 shader strings and a
// reflection-derived TS layout (stride, field offsets, typed packer,
// VERTEX_ATTRIBUTES). The generated file is the single source of truth for all
// per-shader buffer layouts; TS callers import its constants instead of
// hand-maintaining parallel stride/offset declarations.
//
// A `.slang` file may declare targets via a leading comment:
//   //! targets: wgsl, glsl
//   //! targets: wgsl           (compute shaders, WebGPU-only)
// Default: wgsl + glsl.
//
// A shader with entry points emits three modules, and which one a consumer
// imports from decides what the bundler makes it pay for (see
// emitShaderStrings): `<base>.generated.ts` (the WGSL/GLSL strings, re-exporting
// the other two), `<base>.iface.generated.ts` (layout, packers, uniforms) and —
// when it declares `//! export-consts: A, B` — `<base>.consts.generated.ts`,
// which is the numbers alone.
//
// Module files (those whose Slang source begins with `module <name>;`) are
// treated as imports only. A module declaring `//! export-consts` emits just the
// consts module, which is its whole output and so keeps the plain
// `<base>.generated.ts` name.
//
// Three directives redirect an artifact to a repo-relative path, for a package
// that can't import the plugin owning the shader (see OUT_DIRECTIVES):
//   //! layout-out: <path>      instance stride + per-view offset maps only
//   //! consts-out: <path>      the `export-consts` values only
//   //! js-export-out: <path>   the `js-export` twins
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import path from 'node:path'

import { pool } from './pool.ts'
import {
  assertDprDeclared,
  assertNoDeadDprUniform,
  dprConsumersCalled,
  readsDprUniform,
} from './shader-codegen/assertDprDeclared.ts'
import {
  assertSharedUniformBlocksAgree,
  assertUniformLayoutMatches,
} from './shader-codegen/assertUniformLayout.ts'
import { assertVertexInputsMatch } from './shader-codegen/assertVertexInputs.ts'
import {
  assertBindingsMatchWgsl,
  classifyBindings,
} from './shader-codegen/bindings.ts'
import {
  emitConsts,
  emitInterface,
  emitLayoutOnly,
  emitShaderStrings,
  header,
  instanceAttrsFor,
  uniformFieldsFor,
} from './shader-codegen/codegen.ts'
import {
  assertJsSkipsResolve,
  collectExportUses,
  collectSkips,
  emitLiftReport,
} from './shader-codegen/liftReport.ts'
import {
  assertOutPathsUnique,
  parseBlend,
  parseExportedConsts,
  parseInstanceWriter,
  parseJsExports,
  parseJsSkips,
  parseOutPath,
  parseTargets,
  parseTopology,
  parseVertsPerInstance,
  stripComments,
} from './shader-codegen/parseDirectives.ts'
import {
  findCombinedSamplers,
  findEntryPoint,
  findFragmentInputParamName,
  findUniformBlockName,
  findVaryingFieldNames,
  findVertexAttributeStruct,
} from './shader-codegen/reflection.ts'
import {
  stripLineDirectives,
  vulkanGlslToWebgl2,
} from './shader-codegen/vulkanGlslToWebgl2.ts'
import {
  emitJsTwins,
  emitRefusal,
  parseWgsl,
} from './shader-codegen/wgslToJs.ts'

import type { DprBlockUse } from './shader-codegen/assertDprDeclared.ts'
import type { SharedUniformBlock } from './shader-codegen/assertUniformLayout.ts'
import type { ShaderScan } from './shader-codegen/liftReport.ts'
import type { JsExportFn } from './shader-codegen/parseDirectives.ts'
import type { Reflection } from './shader-codegen/reflection.ts'

// How this script gives up, wherever it gives up. `main`'s failures already
// carry the tool's own diagnostic and a Node stack on top of one buries it; the
// setup below `main` runs at module scope, where a throw gets no handler at all
// and prints nothing but a stack.
function fail(message: string): never {
  console.error(`\ngen:shaders failed: ${message}`)
  process.exit(1)
}

const flagValue = (name: string) =>
  process.argv
    .slice(2)
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3)

// The tree to scan for `*.slang` and the base for cache/log paths. Deriving it
// from this file's own location worked only while the package was repo-private:
// once installed, `../../..` resolves to the consumer's node_modules. cwd is
// the same directory in the monorepo (pnpm runs `gen:shaders` from the root),
// so this is a no-op here and portable everywhere else.
const PROJECT_ROOT = path.resolve(
  flagValue('root') ?? process.env.JBROWSE_SHADER_ROOT ?? process.cwd(),
)

const SLANG_VERSION = 'v2026.5.2'
const SLANGC_CACHE = `${PROJECT_ROOT}/.cache/slangc/bin/slangc`

// `naga` (WGSL) and `glslangValidator` (GLSL-ES) are optional validators: they
// don't affect the generated output (that's driven entirely by the pinned
// slangc + the codegen), only whether we catch a bad shader at build time.
// Unlike slangc they aren't auto-fetched, so probe for them once and skip with
// a one-line warning if absent — a contributor can always regenerate; CI
// installs both so validation still runs there. Set NAGA=''/GLSLANG='' to
// silence the warning and force-skip.
function resolveValidator(bin: string, label: string) {
  if (!bin) {
    return undefined
  }
  const probe = spawnSync(bin, ['--version'], { stdio: 'ignore' })
  if (probe.error) {
    console.warn(
      `  warn: ${label} not found (${bin}); skipping ${label} shader ` +
        `validation. Install it to validate generated shaders locally.`,
    )
    return undefined
  }
  return bin
}
const NAGA = resolveValidator(process.env.NAGA ?? 'naga', 'naga')
const GLSLANG = resolveValidator(
  process.env.GLSLANG ?? 'glslangValidator',
  'glslangValidator',
)
// Shaders live alongside their plugin, but shared modules (hpmath, etc.) live
// in render-core so any shader can `import hpmath;`. In this repo that's the
// workspace path; for an out-of-tree plugin it's the installed package, which
// ships src/shaders for exactly this reason.
function resolveSharedInclude() {
  const override = flagValue('shared-include')
  if (override) {
    return path.resolve(override)
  }
  const candidates = [
    path.resolve(PROJECT_ROOT, 'packages/render-core/src/shaders'),
    path.resolve(PROJECT_ROOT, 'node_modules/@jbrowse/render-core/src/shaders'),
  ]
  const found = candidates.find(c => existsSync(c))
  if (!found) {
    fail(
      `Could not find the shared .slang modules. Looked in:\n${candidates
        .map(c => `  ${c}`)
        .join(
          '\n',
        )}\nInstall @jbrowse/render-core, or pass --shared-include=<dir>.`,
    )
  }
  return found
}
const SHARED_INCLUDE = resolveSharedInclude()

// `slangc -v` reports on stderr. A path that is not a binary at all reports
// nothing, and one that does not exist never runs — `spawnSync` sets `error`
// and leaves `stderr` null, which its TYPE does not admit, so the check has to
// be on `error` rather than on the field.
function slangcVersion(bin: string) {
  const probe = spawnSync(bin, ['-v'], { encoding: 'utf8' })
  return probe.error ? '' : probe.stderr.trim()
}

function ensureSlangc() {
  const ver = SLANG_VERSION.replace(/^v/, '')
  // The escape hatch is version-checked too, and it is the one that needs it
  // most: the cache is fetched at the pin, while `SLANGC` is a path a person or
  // a CI image chose — a system slangc, another checkout's copy. A mismatched
  // compiler does not fail, it emits DIFFERENT WGSL for every shader in the
  // tree, so the staleness gate then reports a diff against work nobody did.
  if (process.env.SLANGC) {
    const found = slangcVersion(process.env.SLANGC)
    if (found !== ver) {
      fail(
        `SLANGC=${process.env.SLANGC} reports ${found || 'no version'}, but ` +
          `this tree is pinned to ${ver}. A different slangc re-emits every ` +
          `shader, so the diff would look like yours. Unset SLANGC to fetch ` +
          `the pin, or point it at a ${ver} binary.`,
      )
    }
    return process.env.SLANGC
  }
  if (existsSync(SLANGC_CACHE) && slangcVersion(SLANGC_CACHE) === ver) {
    return SLANGC_CACHE
  }
  const platform = process.platform
  const arch = process.arch
  let asset: string
  if (platform === 'linux' && arch === 'x64') {
    asset = `slang-${ver}-linux-x86_64.tar.gz`
  } else if (platform === 'linux' && arch === 'arm64') {
    asset = `slang-${ver}-linux-aarch64.tar.gz`
  } else if (platform === 'darwin' && arch === 'arm64') {
    asset = `slang-${ver}-macos-aarch64.tar.gz`
  } else if (platform === 'darwin' && arch === 'x64') {
    asset = `slang-${ver}-macos-x86_64.tar.gz`
  } else {
    throw new Error(`Unsupported platform: ${platform}-${arch}`)
  }
  const cacheDir = path.dirname(path.dirname(SLANGC_CACHE))
  mkdirSync(cacheDir, { recursive: true })
  const url = `https://github.com/shader-slang/slang/releases/download/${SLANG_VERSION}/${asset}`
  const tarPath = path.join(cacheDir, asset)
  console.log(`Downloading slangc ${SLANG_VERSION}...`)
  execFileSync('curl', ['-fsSL', '-o', tarPath, url], { stdio: 'inherit' })
  execFileSync('tar', ['xzf', tarPath, '-C', cacheDir], { stdio: 'inherit' })
  rmSync(tarPath)
  chmodSync(SLANGC_CACHE, 0o755)
  console.log(`slangc ${SLANG_VERSION} installed at ${SLANGC_CACHE}`)
  return SLANGC_CACHE
}

const SLANGC = ensureSlangc()

// Run a build tool (slangc/naga/glslang), surfacing its diagnostic on failure.
// Async, and that is the whole build's wall clock: this is called ~5 times per
// shader (three slangc invocations, naga, two glslangValidator runs) and every
// one of those is an independent process doing ~0.7s of work on one core. Run
// serially — as this did — ~40 shaders is several hundred sequential spawns.
//
// Collecting the output by hand rather than through promisify(execFile) keeps
// the failure message the tool's OWN diagnostic (file:line and all) instead of
// an exception whose Buffer fields dump as raw byte arrays. stdout is in the
// message too, not just stderr: glslangValidator reports on stdout, so a GLSL
// validation failure used to print an empty reason.
// It RESOLVES with the failure rather than rejecting, and that is deliberate.
// Validators are started early and awaited late, so a rejection could land
// while this file's task is awaiting something else — a rejection nobody is
// handling yet, which Node answers by killing the process, losing the pool and
// every other file's diagnostic along with this one's. (Found the honest way:
// naga rejected a bad shader and took the whole build down with it.) A promise
// that cannot reject cannot do that, whenever it settles. Call `runOrThrow`
// where the failure should stop the file immediately.
function run(bin: string, args: string[]) {
  return new Promise<Error | undefined>(resolve => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (out += chunk))
    child.stderr.on('data', (chunk: string) => (out += chunk))
    child.on('error', err => {
      resolve(new Error(`${path.basename(bin)}: ${err.message}`))
    })
    child.on('close', (status, signal) => {
      if (status === 0) {
        resolve(undefined)
        return
      }
      // The tool's own diagnostic leads; how the process ended is a footnote.
      // slangc SIGSEGVs on some ordinary source errors AFTER printing a perfect
      // `error[E30015]: undefined identifier` with a caret — and a message
      // opening with "killed by SIGSEGV" sends the reader hunting a toolchain
      // bug over their own typo.
      const name = path.basename(bin)
      const how = signal ? `killed by ${signal}` : `exited with ${status}`
      const diagnostic = out.trim()
      resolve(
        new Error(
          diagnostic
            ? `${name} reported:\n\n${diagnostic}\n\n(${name} ${how})`
            : `${name} ${how}, with no diagnostic`,
        ),
      )
    })
  })
}

// `run`, for the calls whose failure must stop this file right here.
async function runOrThrow(bin: string, args: string[]) {
  const error = await run(bin, args)
  if (error) {
    throw error
  }
}

function walk(dir: string, suffix: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' ||
      entry === '.cache' ||
      entry === 'dist' ||
      entry === 'esm' ||
      entry === 'agent-docs' ||
      entry.startsWith('.')
    ) {
      continue
    }
    const fullPath = path.join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      // Skip dangling symlinks — common in dev trees with stale test_data.
      continue
    }
    if (stat.isDirectory()) {
      walk(fullPath, suffix, out)
    } else if (entry.endsWith(suffix)) {
      out.push(fullPath)
    }
  }
  return out
}

// Files compile concurrently, so a file's progress lines are collected and
// printed as one block when it finishes rather than interleaved with whatever
// else is in flight.
type Log = (line: string) => void

// Every artifact this run produced, absolute. `assertNoOrphans` reads it: an
// artifact nobody wrote is one whose `.slang` was deleted or renamed, or whose
// `//! *-out` directive was dropped — and it stays committed, frozen at its last
// value, with its importers none the wiser. CI's staleness gate cannot see that
// case by construction (there's no diff and the file is tracked), so the driver
// has to be the one to say it.
const WRITTEN = new Set<string>()

// What each entry-point shader's compiled WGSL turned out to contain, for the
// liftability inventory. Collected here rather than in a separate pass because
// the WGSL is already in hand and re-running slangc over ~40 shaders to produce
// a report is how a report ends up behind a flag nobody passes.
//
// Entry-point shaders only, and that is sufficient: slangc inlines every
// function the draw path reaches, including the ones authored in the modules a
// shader imports, so a module's decisions appear under each shader that uses
// them. A module nothing imports has no live functions to lift by definition.
const SCANS: ShaderScan[] = []

// Every name any `//! js-export` names, tree-wide. Filled by `writeJsExports`,
// which is the one place that resolves the directive the same way for a module
// and for a shader with entry points — and tree-wide because a module's export
// is inlined into every importer's WGSL, so it shows up in a dozen scans while
// being declared once.
const EXPORTED = new Set<string>()

// How many emitted uniform blocks `assertUniformLayoutMatches` actually compared,
// summed over the tree. Per shader, "this backend declared no uniform block" is a
// legitimate answer — Slang eliminates a block the entry points never read. Over
// a whole tree it is not: it would mean slangc renamed the declaration and every
// shader is now skipped, which is the one failure a per-shader guard cannot see.
let UNIFORM_BLOCKS_COMPARED = 0

// How many shaders were found to convert CSS px to device px, tree-wide. Zero
// over a full build means `assertDprDeclared`'s call patterns stopped matching
// what slangc emits, not that the tree stopped antialiasing.
let DPR_SHADERS = 0

// The same reads, kept whole so the dead-field half can group them by the
// module declaring the block — a shared block legitimately carries a field only
// some of its passes read.
const DPR_USES: DprBlockUse[] = []

// Every shader's reflected uniform layout, tagged with the `.slang` file whose
// struct declaration it is an instance of. A whole-tree collection because the
// claim is about a GROUP of shaders: nothing a single compile sees can tell
// that its layout of a shared struct differs from a sibling's.
const UNIFORM_BLOCKS: SharedUniformBlock[] = []

const LIFT_REPORT_PATH = 'agent-docs/reference/SHADER_LIFT_INVENTORY.md'

// Write a generated artifact and record it. All artifact writes go through here
// or through `writeOut`; a `writeFileSync` that doesn't will read as an orphan.
//
// Two writers for one path is a build error rather than a race. `assertOutPaths
// Unique` catches the case it can see — two `//! *-out` directives naming the
// same file — but it compares directives against directives, so a `//! layout-
// out` aimed at some other shader's own `<base>.generated.ts` slips past it and
// silently overwrites a full generated module with a layout stub. Checking at
// the write covers every pair of writers, whatever their source, without
// needing to predict which paths a file will produce. Files compile
// concurrently, so which write lands first is nondeterministic; that this fires
// is not.
function emit(log: Log, absPath: string, contents: string) {
  if (WRITTEN.has(absPath)) {
    throw new Error(
      `${absPath.replace(`${PROJECT_ROOT}/`, '')} is written twice in one ` +
        `build. Two shaders (or one shader's directive and another's default ` +
        `output path) claim it, and which one survives depends on which ` +
        `finished last. Only one may own a generated file.`,
    )
  }
  writeFileSync(absPath, contents)
  WRITTEN.add(absPath)
  log(`  ok: ${absPath.replace(`${PROJECT_ROOT}/`, '')}`)
}

// Write a `//! layout-out` / `//! consts-out` artifact at a repo-relative path.
// Both exist so a package that can't import the owning plugin still gets its
// numbers from the shader rather than a hand-kept SYNC copy.
function writeOut(log: Log, relPath: string, contents: string) {
  emit(log, path.join(PROJECT_ROOT, relPath), contents)
}

function writeConstsOut(
  log: Log,
  source: string,
  base: string,
  exportedConsts: Record<string, number> | undefined,
) {
  const constsOut = parseOutPath(source, 'consts')
  if (!constsOut) {
    return
  }
  if (!exportedConsts) {
    throw new Error(
      `//! consts-out needs a //! export-consts directive naming what to write`,
    )
  }
  writeOut(log, constsOut, emitConsts(base, exportedConsts))
}

// Slang dead-code-eliminates anything an entry point can't reach, so asking
// slangc for a module's WGSL directly yields nothing. The driver synthesizes a
// throwaway compute entry that calls each `//! js-export` function, compiles
// *that*, and lifts the emitted bodies. A compute stage is deliberate: slangc's
// CPU targets reject graphics stages outright (`-target c` errors on `max` in a
// vertex entry, `-target cpp` segfaults), and a compute entry is the one shape
// that carries scalar helper code through every target cleanly.
const SLANG_DUMMY_ARG: Record<string, string> = {
  float: 'jsF',
  uint: 'jsU',
  int: 'jsI',
  bool: 'jsB',
}

function buildJsExportWrapper(moduleName: string, fns: JsExportFn[]) {
  const needed = new Set(fns.flatMap(f => f.paramTypes))
  const decls = [
    needed.has('float') ? '  float jsF = float(tid.x);' : '',
    needed.has('uint') ? '  uint jsU = tid.x;' : '',
    needed.has('int') ? '  int jsI = int(tid.x);' : '',
    needed.has('bool') ? '  bool jsB = tid.x != 0u;' : '',
  ].filter(Boolean)
  const calls = fns.map((fn, i) => {
    const args = fn.paramTypes.map(t => SLANG_DUMMY_ARG[t]!).join(', ')
    const call = `${fn.name}(${args})`
    // The sink is `float`, so the probe has to narrow whatever the function
    // returns down to one. It only has to keep the CALL alive — Slang emits the
    // whole function either way — so taking one lane of a vector is enough.
    const asFloat =
      fn.returnType === 'float'
        ? call
        : fn.returnType === 'bool'
          ? `(${call} ? 1.0 : 0.0)`
          : fn.returnType === 'float2'
            ? `(${call}).x`
            : `float(${call})`
    return `  jsExportSink[${i}] = ${asFloat};`
  })
  return [
    `import ${moduleName};`,
    '',
    '[[vk::binding(0, 0)]] RWStructuredBuffer<float> jsExportSink;',
    '',
    '[shader("compute")]',
    '[numthreads(1, 1, 1)]',
    'void jsExportProbe(uint3 tid : SV_DispatchThreadID) {',
    ...decls,
    ...calls,
    '}',
    '',
  ].join('\n')
}

function parseModuleName(source: string, slangPath: string) {
  const m = /^\s*module\s+(\w+)\s*;/m.exec(stripComments(source))
  if (!m) {
    throw new Error(`${slangPath}: //! js-export needs a 'module <name>;' file`)
  }
  return m[1]!
}

// A module's functions are only reachable through an import, so its WGSL has to
// be conjured by the wrapper above.
async function compileJsExportWrapper(
  slangPath: string,
  source: string,
  base: string,
  fns: JsExportFn[],
) {
  const dir = path.dirname(slangPath)
  const moduleName = parseModuleName(source, slangPath)
  const tmp = mkdtempSync(path.join(tmpdir(), `js-export-${base}-`))
  try {
    const wrapperPath = path.join(tmp, `${base}JsExportWrapper.slang`)
    writeFileSync(wrapperPath, buildJsExportWrapper(moduleName, fns))
    const wgslOut = path.join(tmp, `${base}.wgsl`)
    await runOrThrow(SLANGC, [
      wrapperPath,
      '-target',
      'wgsl',
      '-o',
      wgslOut,
      '-I',
      dir,
      '-I',
      SHARED_INCLUDE,
    ])
    return readFileSync(wgslOut, 'utf8')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// `shaderWgsl` is the shader's own compiled WGSL, passed when the file has entry
// points: those already keep the exported functions alive, and a wrapper can't
// `import` such a file anyway. The emitter lifts only what an export reaches, so
// the vertex/fragment support code alongside it is ignored rather than refused.
async function writeJsExports(
  log: Log,
  slangPath: string,
  source: string,
  base: string,
  shaderWgsl?: string,
) {
  // `shaderWgsl` present means this is a shader with entry points, lifted from
  // its own compile — the only case where an export may name a function the
  // shader merely imports (see parseJsExports). A module's wrapper cannot see
  // past its own module, so it gets its own source only.
  const fns = parseJsExports(
    source,
    shaderWgsl ? readImportedSources(slangPath, source) : [],
  )
  if (!fns) {
    return
  }
  for (const fn of fns) {
    EXPORTED.add(fn.name)
  }
  const wgsl =
    shaderWgsl ?? (await compileJsExportWrapper(slangPath, source, base, fns))
  const contents = emitJsTwins(
    base,
    wgsl,
    fns.map(f => f.name),
    header(base),
  )
  const out = parseOutPath(source, 'js-export')
  if (out) {
    writeOut(log, out, contents)
    return
  }
  emit(
    log,
    path.join(path.dirname(slangPath), `${base}.js.generated.ts`),
    contents,
  )
}

// A module declares `module <name>;` and has no entry points — it is compiled
// only as an import. The `[shader(` probe reads the source with its comments
// blanked: several modules discuss the passes that import them, and a mention
// in prose would otherwise make the driver try to compile a module as a
// standalone shader.
function isModuleFile(source: string) {
  const code = stripComments(source)
  return /^\s*module\s+\w+\s*;/m.test(code) && !code.includes('[shader(')
}

// Every module a shader `import`s, transitively, resolved against the same
// include path slangc gets. The constant evaluator reads the sources so a
// shader can write `CURVE_SEGMENTS * 6u` instead of the product spelled out —
// Slang resolves the identifier, and until this existed the codegen could not,
// which is what forced the literal-plus-SYNC-comment pattern. The paths come
// along for `uniformStructOwner`, which needs to name the file a declaration
// came from and not just find its text.
function readImports(
  slangPath: string,
  source: string,
  seen = new Set<string>(),
): { path: string; source: string }[] {
  const dir = path.dirname(slangPath)
  const code = stripComments(source)
  const out: { path: string; source: string }[] = []
  for (const m of code.matchAll(/^\s*import\s+(\w+)\s*;/gm)) {
    const found = [dir, SHARED_INCLUDE]
      .map(d => path.join(d, `${m[1]!}.slang`))
      .find(p => existsSync(p))
    if (!found || seen.has(found)) {
      continue
    }
    seen.add(found)
    const imported = readFileSync(found, 'utf8')
    out.push(
      { path: found, source: imported },
      ...readImports(found, imported, seen),
    )
  }
  return out
}

const readImportedSources = (slangPath: string, source: string) =>
  readImports(slangPath, source).map(m => m.source)

// Which `.slang` file declares the struct a shader's uniform block is an
// instance of — the shader itself, or one of the modules it imports.
//
// The struct NAME comes from reflection rather than being assumed to be
// `Uniforms`: two of the six shared declarations are not called that
// (`RowRectUniforms`, `FeatureGlyphUniforms`), and hardcoding the common
// spelling would have dropped their 7 shaders out of the parity check while
// reporting nothing.
function uniformStructOwner(
  slangPath: string,
  source: string,
  structName: string,
) {
  const declares = (text: string) =>
    new RegExp(String.raw`\bstruct\s+${structName}\b`).test(stripComments(text))
  return declares(source)
    ? slangPath
    : readImports(slangPath, source).find(m => declares(m.source))?.path
}

async function compileOne(log: Log, slangPath: string, source: string) {
  const targets = parseTargets(source)
  const base = path.basename(slangPath, '.slang')
  const dir = path.dirname(slangPath)
  const imported = readImportedSources(slangPath, source)
  const tmp = mkdtempSync(path.join(tmpdir(), `build-shaders-${base}-`))
  try {
    const wgslOut = path.join(tmp, `${base}.wgsl`)
    const reflectionOut = path.join(tmp, `${base}.reflection.json`)

    const slangcArgs = [
      slangPath,
      '-target',
      'wgsl',
      '-o',
      wgslOut,
      '-reflection-json',
      reflectionOut,
      '-I',
      dir,
      '-I',
      SHARED_INCLUDE,
    ]
    await runOrThrow(SLANGC, slangcArgs)
    const wgsl = readFileSync(wgslOut, 'utf8')
    // The two validators only ever read what slangc wrote, so they overlap with
    // the rest of this file's work rather than blocking it.
    //
    // `deferred` is not decoration. A validator that rejects while this function
    // is awaiting something ELSE is a rejection nobody is handling yet, and Node
    // kills the process for it — losing the pool, the other files' diagnostics
    // and this one's, in favour of an unhandled-rejection stack trace. Turning
    // the rejection into a resolved value at the moment the promise is created
    // means the failure waits, intact, for the `await` below. (Found the honest
    // way: naga rejected a bad shader and took the whole build down with it.)
    const validations: Promise<Error | undefined>[] = []
    if (NAGA) {
      validations.push(run(NAGA, [wgslOut]))
    }

    const reflection = JSON.parse(
      readFileSync(reflectionOut, 'utf8'),
    ) as Reflection
    let glslVertex: string | undefined
    let glslFragment: string | undefined

    if (targets.includes('glsl')) {
      const vsName = findEntryPoint(reflection, 'vertex')?.name
      const fsName = findEntryPoint(reflection, 'fragment')?.name
      if (!vsName || !fsName) {
        throw new Error(
          `${slangPath}: targets 'glsl' but missing vertex or fragment entry point`,
        )
      }
      const glslVertexOut = path.join(tmp, `${base}.vert.glsl`)
      const glslFragmentOut = path.join(tmp, `${base}.frag.glsl`)
      const glslArgs = (stage: string, entry: string, out: string) => [
        slangPath,
        '-target',
        'glsl',
        '-stage',
        stage,
        '-entry',
        entry,
        '-o',
        out,
        '-I',
        dir,
        '-I',
        SHARED_INCLUDE,
      ]
      await Promise.all([
        runOrThrow(SLANGC, glslArgs('vertex', vsName, glslVertexOut)),
        runOrThrow(SLANGC, glslArgs('fragment', fsName, glslFragmentOut)),
      ])

      const vertexStruct = findVertexAttributeStruct(reflection)
      const attributes = vertexStruct
        ? {
            prefix: vertexStruct.paramName,
            fieldNames: vertexStruct.struct.fields.map(f => f.name),
          }
        : undefined
      const uniformBlockName = findUniformBlockName(reflection)
      const varyingFieldNames = findVaryingFieldNames(reflection)
      const fragParamName = findFragmentInputParamName(reflection)
      const samplerNames = findCombinedSamplers(reflection).map(s => s.name)

      const rawVert = readFileSync(glslVertexOut, 'utf8')
      const rawFrag = readFileSync(glslFragmentOut, 'utf8')
      glslVertex = vulkanGlslToWebgl2(rawVert, 'vertex', {
        uniformBlockName,
        attributes,
        samplers: samplerNames,
        varyings:
          varyingFieldNames.length > 0
            ? {
                prefix: `entryPointParam_${vsName}`,
                fieldNames: varyingFieldNames,
              }
            : undefined,
      })
      glslFragment = vulkanGlslToWebgl2(rawFrag, 'fragment', {
        uniformBlockName,
        attributes,
        samplers: samplerNames,
        varyings:
          varyingFieldNames.length > 0 && fragParamName
            ? { prefix: fragParamName, fieldNames: varyingFieldNames }
            : undefined,
      })

      const processedVertOut = path.join(tmp, `${base}.vert.es.glsl`)
      const processedFragOut = path.join(tmp, `${base}.frag.es.glsl`)
      writeFileSync(processedVertOut, glslVertex)
      writeFileSync(processedFragOut, glslFragment)
      if (GLSLANG) {
        validations.push(
          run(GLSLANG, ['-S', 'vert', processedVertOut]),
          run(GLSLANG, ['-S', 'frag', processedFragOut]),
        )
      }

      // After the files the validator reads, and only to the strings that get
      // shipped — see stripLineDirectives for which half of the mapping that
      // keeps.
      glslVertex = stripLineDirectives(glslVertex)
      glslFragment = stripLineDirectives(glslFragment)
    }

    // Both fail the build before anything is written. The first validator to
    // have failed is rethrown; the others' messages are lost, which is the same
    // thing a serial build did and one bad shader is one fix.
    const validationError = (await Promise.all(validations)).find(Boolean)
    if (validationError) {
      throw validationError
    }

    // Reflection and the emitted WGSL are two outputs of the same compiler, and
    // only one of them is what the GPU runs. Make them agree about the bindings
    // here, where the message can name the shader — see assertBindingsMatchWgsl.
    assertBindingsMatchWgsl(
      path.relative(PROJECT_ROOT, slangPath),
      classifyBindings(`${base}.slang`, reflection),
      wgsl,
    )

    // Fail here, before writing, if slangc's `@location` assignment disagrees
    // with the tight-packed layout the generated packers assume.
    const instance = instanceAttrsFor(reflection)
    if (instance) {
      assertVertexInputsMatch(
        path.relative(PROJECT_ROOT, slangPath),
        instance.attrs,
        { wgsl, glslVertex },
        instance.source === 'attributes',
      )
    }

    // And the same for the other struct the TS side writes through. Reflection
    // gives these offsets rather than the codegen inventing them, which is why
    // it went unchecked for longer — but reflection and codegen are two slangc
    // outputs, and a disagreement puts every uniform in the shader one word off.
    const uniforms = uniformFieldsFor(reflection)
    if (uniforms) {
      UNIFORM_BLOCKS_COMPARED += assertUniformLayoutMatches(
        path.relative(PROJECT_ROOT, slangPath),
        uniforms.fields,
        uniforms.totalBytes,
        { wgsl, glslVertex },
      )
      const dprCalled = dprConsumersCalled({ wgsl, glslVertex, glslFragment })
      DPR_SHADERS += assertDprDeclared(
        path.relative(PROJECT_ROOT, slangPath),
        uniforms.fields.map(f => f.name),
        dprCalled,
      )
      // The same layout also goes to the tree-wide parity check. The check
      // above compares a shader against its OWN emitted source, so shaders
      // sharing one declaration each pass it however far apart the group has
      // drifted.
      const owner = uniformStructOwner(slangPath, source, uniforms.structName)
      if (!owner) {
        throw new Error(
          `the uniform block is an instance of 'struct ` +
            `${uniforms.structName}', which is declared neither here nor in ` +
            `any module this shader imports. ` +
            `assertSharedUniformBlocksAgree groups shaders by that ` +
            `declaration, so this shader would be checked against nothing — ` +
            `find where the struct comes from and teach uniformStructOwner to ` +
            `resolve it.`,
        )
      }
      UNIFORM_BLOCKS.push({
        shader: path.relative(PROJECT_ROOT, slangPath),
        owner: path.relative(PROJECT_ROOT, owner),
        fields: uniforms.fields,
        totalBytes: uniforms.totalBytes,
      })
      DPR_USES.push({
        shader: path.relative(PROJECT_ROOT, slangPath),
        owner: path.relative(PROJECT_ROOT, owner),
        fieldNames: uniforms.fields.map(f => f.name),
        reads: readsDprUniform({ wgsl, glslVertex, glslFragment }),
      })
    }

    const codegenInputs = {
      baseName: base,
      reflection,
      wgsl,
      glslVertex,
      glslFragment,
      textures: findCombinedSamplers(reflection),
      vertsPerInstance: parseVertsPerInstance(source, imported),
      exportedConsts: parseExportedConsts(source, imported),
      topology: parseTopology(source),
      blend: parseBlend(source),
      instanceWriter: parseInstanceWriter(source),
    }
    // The interface is emitted FIRST, because it is the one that refuses an
    // unmodeled uniform/instance field or a second sampler. Writing the strings
    // module before that check leaves a half-updated pair on disk when it fires.
    const iface = emitInterface(codegenInputs)
    emit(
      log,
      path.join(dir, `${base}.generated.ts`),
      emitShaderStrings(codegenInputs),
    )
    emit(log, path.join(dir, `${base}.iface.generated.ts`), iface)
    if (codegenInputs.exportedConsts) {
      emit(
        log,
        path.join(dir, `${base}.consts.generated.ts`),
        emitConsts(base, codegenInputs.exportedConsts),
      )
    }

    const layoutOut = parseOutPath(source, 'layout')
    if (layoutOut) {
      writeOut(
        log,
        layoutOut,
        emitLayoutOnly({
          baseName: base,
          reflection,
          instanceWriter: parseInstanceWriter(source),
        }),
      )
    }
    writeConstsOut(log, source, base, codegenInputs.exportedConsts)
    await writeJsExports(log, slangPath, source, base, wgsl)

    // Read the WGSL back through the emitter's own parser. Deliberately the
    // same parser rather than a second opinion: the point of the inventory is
    // to report what THIS emitter can and cannot do, so a divergent scanner
    // would describe a subset nobody can actually generate from.
    // Parsed AND emitted, not merely parsed. A function whose body calls an
    // unsupported builtin parses cleanly — the parser accepts any call — and is
    // only refused when the emitter reaches the call. Reporting it as liftable
    // sends a reader to `//! js-export` for a rejection; see `emitRefusal`.
    const parsed = parseWgsl(wgsl)
    const inSubset = []
    const refused = [...parsed.refused]
    for (const fn of parsed.fns) {
      const reason = emitRefusal(parsed, fn.name)
      if (reason === undefined) {
        inSubset.push(fn)
      } else {
        refused.push({ name: fn.name, reason })
      }
    }
    SCANS.push({
      shader: path.relative(PROJECT_ROOT, slangPath),
      inSubset,
      refused,
    })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// A module compiles to nothing on its own; it contributes only the artifacts
// its directives ask for.
async function emitModuleArtifacts(
  log: Log,
  slangPath: string,
  source: string,
) {
  const base = path.basename(slangPath, '.slang')
  const exportedConsts = parseExportedConsts(
    source,
    readImportedSources(slangPath, source),
  )
  if (exportedConsts) {
    emit(
      log,
      path.join(path.dirname(slangPath), `${base}.generated.ts`),
      emitConsts(base, exportedConsts),
    )
  }
  writeConstsOut(log, source, base, exportedConsts)
  await writeJsExports(log, slangPath, source, base)
}

// Committed artifacts that carry our banner but that this run did not write.
// Only meaningful after a FULL build — given an explicit path list, every other
// shader's artifacts are "not written" for the ordinary reason.
function assertNoOrphans() {
  const banner = header('x')[0]!.split(' from ')[0]!
  const orphans = walk(PROJECT_ROOT, '.generated.ts')
    .filter(p => !WRITTEN.has(p))
    .filter(p => readFileSync(p, 'utf8').startsWith(banner))
  if (orphans.length > 0) {
    throw new Error(
      `${orphans.length} generated file(s) that no .slang produces:\n${orphans
        .map(p => `  ${p.replace(`${PROJECT_ROOT}/`, '')}`)
        .join(
          '\n',
        )}\nA renamed or deleted shader, or a dropped //! layout-out / ` +
        `consts-out / js-export-out. The file is still committed and still ` +
        `imported, and it will never be regenerated again — delete it, or ` +
        `restore the directive that owned it.`,
    )
  }
}

async function main() {
  const argPaths = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const paths = argPaths.length > 0 ? argPaths : walk(PROJECT_ROOT, '.slang')
  const files = paths.map(p => ({ path: p, source: readFileSync(p, 'utf8') }))
  assertOutPathsUnique(files)
  // Leave a couple of cores for everything else on the machine (and for this
  // process, which does the codegen between spawns).
  const limit = Math.max(1, availableParallelism() - 2)
  console.log(`Found ${files.length} .slang file(s); building ${limit}-way`)

  const failures = await pool(files, limit, async file => {
    const lines: string[] = [file.path.replace(`${PROJECT_ROOT}/`, '')]
    const log: Log = line => lines.push(line)
    try {
      await (isModuleFile(file.source)
        ? emitModuleArtifacts(log, file.path, file.source)
        : compileOne(log, file.path, file.source))
    } finally {
      // Print what did land even when the compile threw, so the failure report
      // at the end reads against the same progress a serial build showed.
      console.log(lines.join('\n'))
    }
  })

  if (failures.length > 0) {
    for (const { item, error } of failures) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `\n${item.path.replace(`${PROJECT_ROOT}/`, '')}: ${message}`,
      )
    }
    throw new Error(
      `${failures.length} of ${files.length} .slang file(s) failed`,
    )
  }
  // Before the whole-tree block below, because a scoped run compiling two
  // members of one group is a real comparison and gets to make it. What a
  // scoped run cannot see is the shader it did NOT compile — the stale
  // generated module left behind by regenerating a subset — so the count is a
  // tree-wide claim even though the comparison is not.
  const sharedStructs = assertSharedUniformBlocksAgree(UNIFORM_BLOCKS)
  // Both are whole-tree claims, so both are meaningful only after a FULL build.
  // Given an explicit path list the scan covers those shaders alone, and
  // writing the report from it would delete every other shader's rows.
  if (argPaths.length === 0) {
    if (UNIFORM_BLOCKS_COMPARED === 0) {
      throw new Error(
        `no shader's uniform block was compared against its emitted source. ` +
          `Every shader in the tree read as "Slang eliminated the block", which ` +
          `one shader legitimately can be and all of them cannot — slangc has ` +
          `changed how it declares a uniform block, and assertUniformLayout.ts's ` +
          `patterns need updating before the layout is trusted again.`,
      )
    }
    console.log(
      `  ok: ${UNIFORM_BLOCKS_COMPARED} uniform block(s) agree with their emitted layout`,
    )
    if (DPR_SHADERS === 0) {
      throw new Error(
        `no shader was found to convert CSS px to device px, so the ` +
          `devicePixelRatio check compared nothing. Nine did when it landed ` +
          `— every arc pass, both capsule consumers, both point-glyph ` +
          `consumers — so this means slangc stopped emitting those calls ` +
          `under the names assertDprDeclared matches, and a shader can now ` +
          `antialias against a constant unnoticed.`,
      )
    }
    assertNoDeadDprUniform(DPR_USES)
    console.log(
      `  ok: ${DPR_SHADERS} shader(s) converting CSS px to device px declare the ratio`,
    )
    if (sharedStructs === 0) {
      throw new Error(
        `no uniform struct was found to be shared by two shaders, so the ` +
          `cross-shader layout parity check compared nothing. Six ` +
          `declarations were shared when it landed — the alignments block's ` +
          `19 passes among them — so this means uniformStructOwner stopped ` +
          `resolving a struct to the module that declares it, and every ` +
          `shader now reads as the sole owner of its own block.`,
      )
    }
    console.log(
      `  ok: ${sharedStructs} shared uniform struct(s) lay out identically in every shader compiled against them`,
    )
    assertNoOrphans()
    // Skips come from every file, modules included — see `collectSkips`.
    const skips = collectSkips(
      files.map(f => ({
        shader: f.path.replace(`${PROJECT_ROOT}/`, ''),
        skips: parseJsSkips(f.source),
      })),
    )
    assertJsSkipsResolve(SCANS, EXPORTED, skips)
    // Who imports each twin. A whole-tree read, so it belongs with the other
    // whole-tree claims here rather than in the per-file compile: consumers of
    // a module-authored export live anywhere, and `walk` already skips
    // node_modules, dist, esm and every dotted directory (agent worktrees
    // included).
    const consumers = [
      ...walk(PROJECT_ROOT, '.ts'),
      ...walk(PROJECT_ROOT, '.tsx'),
    ]
      .filter(p => !p.endsWith('.generated.ts'))
      .map(p => ({
        path: path.relative(PROJECT_ROOT, p),
        text: readFileSync(p, 'utf8'),
      }))
    writeFileSync(
      path.join(PROJECT_ROOT, LIFT_REPORT_PATH),
      emitLiftReport(
        SCANS,
        EXPORTED,
        skips,
        collectExportUses(consumers, EXPORTED),
      ),
    )
    console.log(`  ok: ${LIFT_REPORT_PATH}`)
  } else {
    // Say so, rather than skipping in silence. A path-scoped run is the one the
    // shared-worktree guidance recommends, so this is the mode people actually
    // use — and a shader edit that adds a Candidates row would then produce no
    // local signal at all, surfacing hours later as a red CI job.
    console.log(
      `\nnote: ${LIFT_REPORT_PATH} was NOT updated — it is a whole-tree ` +
        `artifact and this run was scoped to ${argPaths.length} path(s). Run ` +
        `\`pnpm gen:shaders\` with no arguments before committing.`,
    )
  }
}

try {
  await main()
} catch (e) {
  // run() already put the tool's diagnostic in the Error message; print just
  // that (no Node stack / raw Buffer dump) and fail the build.
  fail(e instanceof Error ? e.message : String(e))
}
