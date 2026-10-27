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
// A shader with entry points emits three modules a consumer imports, and which
// one decides what the bundler makes it pay for (see emitShaderModule):
// `<base>.generated.ts` (the `SOURCE` loaders, re-exporting the other two),
// `<base>.iface.generated.ts` (layout, packers, uniforms) and — when it declares
// `//! export-consts: A, B` — `<base>.consts.generated.ts`, the numbers alone.
// Its text goes to `<base>.wgsl.generated.ts` / `<base>.glsl.generated.ts`,
// which only `SOURCE`'s `import()`s reach.
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
//
// Every artifact carries an `// inputs:` stamp, a hash of the `.slang` and
// everything it imports (see stamp.ts). Flags:
//   --check      say which generated files are stale, without slangc
//   --watch      rebuild on every .slang save
//   --no-cache   recompile every file; otherwise a file whose stamp and
//                toolchain match a `.cache/shaders` entry is not recompiled
import { execFileSync, fork, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  watch,
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
  assertStageReadsMatchWgsl,
  classifyBindings,
} from './shader-codegen/bindings.ts'
import {
  emitConsts,
  emitGlslText,
  emitInterface,
  emitLayoutOnly,
  emitShaderModule,
  emitWgslText,
  header,
  instanceAttrsFor,
  shaderTextFile,
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
  parseCoverage,
  parseExportedConsts,
  parseInstanceWriter,
  parseJsExports,
  parseJsSkips,
  parseOutPath,
  parseTargets,
  parseTopology,
  parseVertsPerInstance,
  resolveTextureFilters,
  stripComments,
} from './shader-codegen/parseDirectives.ts'
import { createImportResolver } from './shader-codegen/readImports.ts'
import {
  findCombinedSamplers,
  findEntryPoint,
  findFragmentInputParamName,
  findUniformBlockName,
  findVaryingFieldNames,
  findVertexAttributeStruct,
  withEntryPointReads,
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
import { inputsHash, readStamp, stampArtifact } from './stamp.ts'
import { openTint } from './tint.ts'

import type { DprBlockUse } from './shader-codegen/assertDprDeclared.ts'
import type { SharedUniformBlock } from './shader-codegen/assertUniformLayout.ts'
import type { ShaderScan } from './shader-codegen/liftReport.ts'
import type { JsExportFn } from './shader-codegen/parseDirectives.ts'
import type { SlangFile } from './shader-codegen/readImports.ts'
import type { Reflection } from './shader-codegen/reflection.ts'
import type { SpawnRequest, SpawnResult } from './spawner.ts'
import type { WgslValidator } from './tint.ts'

// How this script gives up, wherever it gives up. `build`'s failures already
// carry the tool's own diagnostic and a Node stack on top of one buries it.
function fail(message: string): never {
  console.error(`\ngen:shaders failed: ${message}`)
  process.exit(1)
}

const ARGS = process.argv.slice(2)
const hasFlag = (name: string) => ARGS.includes(`--${name}`)
const flagValue = (name: string) =>
  ARGS.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)

// The tree to scan for `*.slang` and the base for cache/log paths. Deriving it
// from this file's own location worked only while the package was repo-private:
// once installed, `../../..` resolves to the consumer's node_modules. cwd is
// the same directory in the monorepo (pnpm runs `gen:shaders` from the root),
// so this is a no-op here and portable everywhere else.
const PROJECT_ROOT = path.resolve(
  flagValue('root') ?? process.env.JBROWSE_SHADER_ROOT ?? process.cwd(),
)

/** Repo-relative and `/`-separated, as every message and stamp spells it. */
const rel = (p: string) =>
  path.relative(PROJECT_ROOT, p).split(path.sep).join('/')

const SLANG_VERSION = 'v2026.5.2'
const SLANGC_CACHE = `${PROJECT_ROOT}/.cache/slangc/bin/slangc`
const BUILD_CACHE = `${PROJECT_ROOT}/.cache/shaders`

// glslangValidator is optional: it affects whether a bad GLSL-ES shader is
// caught at build time, never the output. Unlike slangc it isn't auto-fetched,
// so probe for it once and skip with a one-line warning if absent; CI installs
// it. Set GLSLANG='' to silence the warning and force-skip.
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

// Tint is in-process through the `webgpu` package, a devDependency here and
// optional for an out-of-tree plugin.
function tintInstalled() {
  try {
    import.meta.resolve('webgpu')
    return true
  } catch {
    console.warn(
      `  warn: the webgpu package is not installed; skipping Tint, the WGSL ` +
        `validator WebGPU browsers run. Install it to validate generated ` +
        `shaders locally.`,
    )
    return false
  }
}

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

interface Validators {
  tint: boolean
  glslang: string | undefined
}

interface Toolchain {
  slangc: string
  tint: WgslValidator | undefined
  glslang: string | undefined
}

// Opened on the first file the cache cannot answer, so a fully cached build
// neither fetches slangc nor starts Dawn.
let toolchain: Promise<Toolchain> | undefined
async function startToolchain(validators: Validators): Promise<Toolchain> {
  return {
    slangc: ensureSlangc(),
    tint: validators.tint ? await openTint() : undefined,
    glslang: validators.glslang,
  }
}
const openToolchain = (validators: Validators) =>
  (toolchain ??= startToolchain(validators))

// The children start in spawner.ts rather than here: see its header.
function openSpawner() {
  const helper = fork(
    path.join(
      import.meta.dirname,
      `spawner${path.extname(import.meta.filename)}`,
    ),
    [],
    { execArgv: [], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] },
  )
  const pending = new Map<number, (result: SpawnResult) => void>()
  let nextId = 0
  helper.unref()
  helper.channel?.unref()
  helper.on('message', (result: SpawnResult) => {
    pending.get(result.id)?.(result)
    pending.delete(result.id)
    if (pending.size === 0) {
      helper.channel?.unref()
    }
  })
  helper.on('exit', (status, signal) => {
    for (const [id, resolve] of pending) {
      resolve({
        id,
        status: null,
        signal: null,
        output: '',
        error: `the spawner process died (${signal ?? status})`,
      })
    }
    pending.clear()
  })
  return (bin: string, args: string[]) =>
    new Promise<SpawnResult>(resolve => {
      const id = nextId++
      pending.set(id, resolve)
      helper.channel?.ref()
      helper.send({ id, bin, args } satisfies SpawnRequest)
    })
}
let spawner: ReturnType<typeof openSpawner> | undefined

// Run a build tool (slangc, glslangValidator), surfacing its diagnostic on
// failure. Called ~4 times per shader, each an independent process doing ~0.7s
// of work on one core, so the pool runs them concurrently.
//
// The failure message is the tool's OWN diagnostic (file:line and all), with
// stdout included: glslangValidator reports on stdout.
//
// It RESOLVES with the failure rather than rejecting, and that is deliberate.
// Validators are started early and awaited late, so a rejection could land
// while this file's task is awaiting something else — a rejection nobody is
// handling yet, which Node answers by killing the process, losing the pool and
// every other file's diagnostic along with this one's. Call `runOrThrow` where
// the failure should stop the file immediately.
async function run(bin: string, args: string[]) {
  const result = await (spawner ??= openSpawner())(bin, args)
  const name = path.basename(bin)
  if (result.error) {
    return new Error(`${name}: ${result.error}`)
  }
  if (result.status === 0) {
    return undefined
  }
  // The tool's own diagnostic leads; how the process ended is a footnote.
  // slangc SIGSEGVs on some ordinary source errors AFTER printing a perfect
  // `error[E30015]: undefined identifier` with a caret — and a message opening
  // with "killed by SIGSEGV" sends the reader hunting a toolchain bug over
  // their own typo.
  const how = result.signal
    ? `killed by ${result.signal}`
    : `exited with ${result.status}`
  const diagnostic = result.output.trim()
  return new Error(
    diagnostic
      ? `${name} reported:\n\n${diagnostic}\n\n(${name} ${how})`
      : `${name} ${how}, with no diagnostic`,
  )
}

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

/**
 * What one `.slang` contributes to the build: its artifacts, and the facts the
 * whole-tree checks read. Plain JSON, because a cache hit answers with the
 * stored copy instead of compiling.
 */
interface FileResult {
  /** Repo-relative paths of every artifact the file wrote. */
  artifacts: string[]
  /** Every name its `//! js-export` names. */
  exported: string[]
  /**
   * What its compiled WGSL turned out to contain, for the liftability
   * inventory. Entry-point shaders only, which suffices: slangc inlines every
   * function the draw path reaches, modules' included.
   */
  scan?: ShaderScan
  /**
   * Its reflected uniform layout, tagged with the `.slang` whose struct it
   * instantiates. Nothing a single compile sees can tell that its layout of a
   * shared struct differs from a sibling's, so the group is compared after.
   */
  uniformBlock?: SharedUniformBlock
  /** The same reads, for the dead-field half of the dpr check. */
  dprUse?: DprBlockUse
  /** Uniform blocks `assertUniformLayoutMatches` compared. */
  uniformBlocksCompared: number
  /** Whether the shader converts CSS px to device px (0 or 1). */
  dprShaders: number
}

interface FileContext {
  log: Log
  slangRel: string
  stamp: string
  tools: Toolchain
  /** Every artifact path any file in this build has written, absolute. */
  claimed: Set<string>
  result: FileResult
}

const LIFT_REPORT_PATH = 'agent-docs/reference/SHADER_LIFT_INVENTORY.md'

const BANNER = header('x')[0]!.split(' from ')[0]!

// Rewriting a file with what it already holds only moves its mtime, which a
// dev server answers with a reload.
function writeIfChanged(absPath: string, contents: string) {
  if (existsSync(absPath) && readFileSync(absPath, 'utf8') === contents) {
    return false
  }
  writeFileSync(absPath, contents)
  return true
}

// Write a generated artifact and record it. All artifact writes go through here
// or through `writeOut`; a `writeFileSync` that doesn't will read as an orphan.
//
// Two writers for one path is a build error rather than a race.
// `assertOutPathsUnique` catches the case it can see — two `//! *-out`
// directives naming the same file — but a `//! layout-out` aimed at some other
// shader's own `<base>.generated.ts` slips past it and would silently
// overwrite a full generated module with a layout stub. Checking at the write
// covers every pair of writers. Files compile concurrently, so which write
// lands first is nondeterministic; that this fires is not.
function emit(ctx: FileContext, absPath: string, contents: string) {
  if (ctx.claimed.has(absPath)) {
    throw new Error(
      `${rel(absPath)} is written twice in one build. Two shaders (or one ` +
        `shader's directive and another's default output path) claim it, and ` +
        `which one survives depends on which finished last. Only one may own ` +
        `a generated file.`,
    )
  }
  ctx.claimed.add(absPath)
  ctx.result.artifacts.push(rel(absPath))
  if (
    writeIfChanged(absPath, stampArtifact(contents, ctx.stamp, ctx.slangRel))
  ) {
    ctx.log(`  ok: ${rel(absPath)}`)
  }
}

// Write a `//! layout-out` / `//! consts-out` artifact at a repo-relative path.
// Both exist so a package that can't import the owning plugin still gets its
// numbers from the shader rather than a hand-kept SYNC copy.
function writeOut(ctx: FileContext, relPath: string, contents: string) {
  emit(ctx, path.join(PROJECT_ROOT, relPath), contents)
}

function writeConstsOut(
  ctx: FileContext,
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
  writeOut(ctx, constsOut, emitConsts(base, exportedConsts))
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
  ctx: FileContext,
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
    await runOrThrow(ctx.tools.slangc, [
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
  ctx: FileContext,
  file: ShaderFile,
  base: string,
  shaderWgsl?: string,
) {
  // `shaderWgsl` present means this is a shader with entry points, lifted from
  // its own compile — the only case where an export may name a function the
  // shader merely imports (see parseJsExports). A module's wrapper cannot see
  // past its own module, so it gets its own source only.
  const fns = parseJsExports(
    file.source,
    shaderWgsl ? file.imports.map(m => m.source) : [],
  )
  if (!fns) {
    return
  }
  ctx.result.exported.push(...fns.map(f => f.name))
  const wgsl =
    shaderWgsl ??
    (await compileJsExportWrapper(ctx, file.path, file.source, base, fns))
  const contents = emitJsTwins(
    base,
    wgsl,
    fns.map(f => f.name),
    header(base),
  )
  const out = parseOutPath(file.source, 'js-export')
  if (out) {
    writeOut(ctx, out, contents)
    return
  }
  emit(
    ctx,
    path.join(path.dirname(file.path), `${base}.js.generated.ts`),
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

interface ShaderFile extends SlangFile {
  /** Everything it imports, transitively. */
  imports: SlangFile[]
}

// Which `.slang` file declares the struct a shader's uniform block is an
// instance of — the shader itself, or one of the modules it imports.
//
// The struct NAME comes from reflection rather than being assumed to be
// `Uniforms`: two of the shared declarations are not called that
// (`RowRectUniforms`, `FeatureGlyphUniforms`), and hardcoding the common
// spelling would have dropped their shaders out of the parity check while
// reporting nothing.
function uniformStructOwner(file: ShaderFile, structName: string) {
  const declares = (text: string) =>
    new RegExp(String.raw`\bstruct\s+${structName}\b`).test(stripComments(text))
  return declares(file.source)
    ? file.path
    : file.imports.find(m => declares(m.source))?.path
}

async function compileOne(ctx: FileContext, file: ShaderFile) {
  const { slangc, tint, glslang } = ctx.tools
  const slangPath = file.path
  const source = file.source
  const targets = parseTargets(source)
  const base = path.basename(slangPath, '.slang')
  const dir = path.dirname(slangPath)
  const imported = file.imports.map(m => m.source)
  const tmp = mkdtempSync(path.join(tmpdir(), `build-shaders-${base}-`))
  try {
    const wgslOut = path.join(tmp, `${base}.wgsl`)
    const reflectionOut = path.join(tmp, `${base}.reflection.json`)

    await runOrThrow(slangc, [
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
    ])
    const wgsl = readFileSync(wgslOut, 'utf8')
    // The validators only ever read what slangc wrote, so they overlap with
    // the rest of this file's work rather than blocking it. Each promise
    // resolves with its failure instead of rejecting (see `run`), so a failure
    // waits, intact, for the `await` below.
    const validations: Promise<Error | undefined>[] = []
    if (tint) {
      validations.push(
        tint(wgsl).then(
          message =>
            message
              ? new Error(
                  `Tint, the WGSL validator WebGPU browsers run, rejected ` +
                    `slangc's output:\n\n${message}`,
                )
              : undefined,
          (error: unknown) =>
            error instanceof Error ? error : new Error(String(error)),
        ),
      )
    }

    const moduleReflection = JSON.parse(
      readFileSync(reflectionOut, 'utf8'),
    ) as Reflection
    const glsl = targets.includes('glsl')
    const vs = findEntryPoint(moduleReflection, 'vertex')
    const fs = findEntryPoint(moduleReflection, 'fragment')
    if (glsl && (!vs || !fs)) {
      throw new Error(
        `${slangPath}: targets 'glsl' but missing vertex or fragment entry point`,
      )
    }

    // Each entry point compiled alone, the one compile where slangc says which
    // bindings it reads. For a shader targeting GLSL that is the stage's GLSL
    // compile; otherwise only its reflection is kept. slangc 2026.5.2 refuses
    // one invocation per stage pair (E00070 for every `-entry`/`-o` order).
    const stageTarget = glsl ? 'glsl' : 'wgsl'
    const aloneOut = (entry: string) =>
      path.join(tmp, `${base}.${entry}.${stageTarget}`)
    const alone = await Promise.all(
      moduleReflection.entryPoints.map(async e => {
        const out = aloneOut(e.name)
        await runOrThrow(slangc, [
          slangPath,
          '-target',
          stageTarget,
          '-stage',
          e.stage,
          '-entry',
          e.name,
          '-o',
          out,
          '-reflection-json',
          `${out}.json`,
          '-I',
          dir,
          '-I',
          SHARED_INCLUDE,
        ])
        return JSON.parse(readFileSync(`${out}.json`, 'utf8')) as Reflection
      }),
    )
    const reflection = withEntryPointReads(moduleReflection, alone)
    let glslVertex: string | undefined
    let glslFragment: string | undefined

    if (glsl && vs && fs) {
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

      const rawVert = readFileSync(aloneOut(vs.name), 'utf8')
      const rawFrag = readFileSync(aloneOut(fs.name), 'utf8')
      glslVertex = vulkanGlslToWebgl2(rawVert, 'vertex', {
        uniformBlockName,
        attributes,
        samplers: samplerNames,
        varyings:
          varyingFieldNames.length > 0
            ? {
                prefix: `entryPointParam_${vs.name}`,
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
      if (glslang) {
        validations.push(
          run(glslang, ['-S', 'vert', processedVertOut]),
          run(glslang, ['-S', 'frag', processedFragOut]),
        )
      }

      // After the files the validator reads, and only to the strings that get
      // shipped — see stripLineDirectives for which half of the mapping that
      // keeps.
      glslVertex = stripLineDirectives(glslVertex)
      glslFragment = stripLineDirectives(glslFragment)
    }

    // Both fail the build before anything is written. The first validator to
    // have failed is rethrown; one bad shader is one fix.
    const validationError = (await Promise.all(validations)).find(Boolean)
    if (validationError) {
      throw validationError
    }

    // Reflection and the emitted WGSL are two outputs of the same compiler, and
    // only one of them is what the GPU runs. Make them agree about the bindings
    // here, where the message can name the shader — see assertBindingsMatchWgsl.
    const bindings = classifyBindings(`${base}.slang`, reflection)
    assertBindingsMatchWgsl(ctx.slangRel, bindings, wgsl)
    assertStageReadsMatchWgsl(
      ctx.slangRel,
      bindings,
      reflection.entryPoints,
      wgsl,
    )

    // Fail here, before writing, if slangc's `@location` assignment disagrees
    // with the tight-packed layout the generated packers assume.
    const instance = instanceAttrsFor(reflection)
    if (instance) {
      assertVertexInputsMatch(
        ctx.slangRel,
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
      ctx.result.uniformBlocksCompared = assertUniformLayoutMatches(
        ctx.slangRel,
        uniforms.fields,
        uniforms.totalBytes,
        { wgsl, glslVertex },
      )
      const dprCalled = dprConsumersCalled({ wgsl, glslVertex, glslFragment })
      ctx.result.dprShaders = assertDprDeclared(
        ctx.slangRel,
        uniforms.fields.map(f => f.name),
        dprCalled,
      )
      // The same layout also goes to the tree-wide parity check. The check
      // above compares a shader against its OWN emitted source, so shaders
      // sharing one declaration each pass it however far apart the group has
      // drifted.
      const owner = uniformStructOwner(file, uniforms.structName)
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
      ctx.result.uniformBlock = {
        shader: ctx.slangRel,
        owner: rel(owner),
        fields: uniforms.fields,
        totalBytes: uniforms.totalBytes,
      }
      ctx.result.dprUse = {
        shader: ctx.slangRel,
        owner: rel(owner),
        fieldNames: uniforms.fields.map(f => f.name),
        reads: readsDprUniform({ wgsl, glslVertex, glslFragment }),
      }
    }

    const textures = findCombinedSamplers(reflection)
    const codegenInputs = {
      baseName: base,
      reflection,
      wgsl,
      glslVertex,
      glslFragment,
      textures,
      vertsPerInstance: parseVertsPerInstance(source, imported),
      exportedConsts: parseExportedConsts(source, imported),
      topology: parseTopology(source),
      blend: parseBlend(source),
      coverage: parseCoverage(source),
      textureFilters: resolveTextureFilters(
        ctx.slangRel,
        source,
        file.imports.map(m => ({ path: rel(m.path), source: m.source })),
        textures.map(t => t.name),
      ),
      instanceWriter: parseInstanceWriter(source),
    }
    // The interface is emitted FIRST, because it is the one that refuses an
    // unmodeled uniform/instance field or a second sampler. Writing the other
    // modules before that check leaves a half-updated set on disk when it fires.
    const iface = emitInterface(codegenInputs)
    emit(
      ctx,
      path.join(dir, `${base}.generated.ts`),
      emitShaderModule(codegenInputs),
    )
    emit(ctx, path.join(dir, `${base}.iface.generated.ts`), iface)
    for (const [target, text] of [
      ['wgsl', emitWgslText(codegenInputs)],
      ['glsl', emitGlslText(codegenInputs)],
    ] as const) {
      if (text !== undefined) {
        emit(ctx, path.join(dir, shaderTextFile(base, target)), text)
      }
    }
    if (codegenInputs.exportedConsts) {
      emit(
        ctx,
        path.join(dir, `${base}.consts.generated.ts`),
        emitConsts(base, codegenInputs.exportedConsts),
      )
    }

    const layoutOut = parseOutPath(source, 'layout')
    if (layoutOut) {
      writeOut(
        ctx,
        layoutOut,
        emitLayoutOnly({
          baseName: base,
          reflection,
          instanceWriter: parseInstanceWriter(source),
        }),
      )
    }
    writeConstsOut(ctx, source, base, codegenInputs.exportedConsts)
    await writeJsExports(ctx, file, base, wgsl)

    // Read the WGSL back through the emitter's own parser. Deliberately the
    // same parser rather than a second opinion: the point of the inventory is
    // to report what THIS emitter can and cannot do, so a divergent scanner
    // would describe a subset nobody can actually generate from.
    // Parsed AND emitted, not merely parsed. A function whose body calls an
    // unsupported builtin parses cleanly — the parser accepts any call — and is
    // only refused when the emitter reaches the call. Reporting it as liftable
    // sends a reader to `//! js-export` for a rejection; see `emitRefusal`.
    const parsed = parseWgsl(wgsl)
    const scan: ShaderScan = {
      shader: ctx.slangRel,
      inSubset: [],
      refused: [...parsed.refused],
    }
    for (const fn of parsed.fns) {
      const reason = emitRefusal(parsed, fn.name)
      if (reason === undefined) {
        scan.inSubset.push({
          name: fn.name,
          params: fn.params,
          returnType: fn.returnType,
        })
      } else {
        scan.refused.push({ name: fn.name, reason })
      }
    }
    ctx.result.scan = scan
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

// A module compiles to nothing on its own; it contributes only the artifacts
// its directives ask for.
async function emitModuleArtifacts(ctx: FileContext, file: ShaderFile) {
  const base = path.basename(file.path, '.slang')
  const exportedConsts = parseExportedConsts(
    file.source,
    file.imports.map(m => m.source),
  )
  if (exportedConsts) {
    emit(
      ctx,
      path.join(path.dirname(file.path), `${base}.generated.ts`),
      emitConsts(base, exportedConsts),
    )
  }
  writeConstsOut(ctx, file.source, base, exportedConsts)
  await writeJsExports(ctx, file, base)
}

// The codegen itself is an input to every artifact, though not to the stamp:
// a stamp moving on every codegen edit would rewrite every generated file.
// The cache keys on it instead.
function hashOwnSources() {
  const hash = createHash('sha256')
  const files = walkAll(import.meta.dirname)
    .filter(p => /\.(ts|js)$/.test(p) && !/\.test\.(ts|js)$/.test(p))
    .sort()
  for (const p of files) {
    hash.update(`\0${path.relative(import.meta.dirname, p)}\0`)
    hash.update(readFileSync(p))
  }
  return hash.digest('hex')
}

function walkAll(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory()
      ? walkAll(path.join(dir, e.name))
      : [path.join(dir, e.name)],
  )
}

const stampOf = (file: ShaderFile) =>
  inputsHash(
    SLANG_VERSION,
    { path: rel(file.path), source: file.source },
    file.imports.map(m => ({ path: rel(m.path), source: m.source })),
  )

const cachePath = (key: string) => path.join(BUILD_CACHE, `${key}.json`)

// A hit needs every artifact the entry lists to be on disk under this stamp:
// a checkout that moved a generated file back, or deleted one, recompiles.
function readCached(key: string, stamp: string) {
  let result: FileResult
  try {
    result = JSON.parse(readFileSync(cachePath(key), 'utf8')) as FileResult
  } catch {
    return undefined
  }
  const current = result.artifacts.every(a => {
    const abs = path.join(PROJECT_ROOT, a)
    return (
      existsSync(abs) && readStamp(readFileSync(abs, 'utf8'))?.hash === stamp
    )
  })
  return current ? result : undefined
}

function writeCached(key: string, result: FileResult) {
  mkdirSync(BUILD_CACHE, { recursive: true })
  writeFileSync(cachePath(key), JSON.stringify(result))
}

// After a full build, an entry no file used is one no file will use again
// until its inputs come back.
function pruneCache(used: ReadonlySet<string>) {
  if (!existsSync(BUILD_CACHE)) {
    return
  }
  for (const entry of readdirSync(BUILD_CACHE)) {
    if (!used.has(entry.replace(/\.json$/, ''))) {
      rmSync(path.join(BUILD_CACHE, entry), { force: true })
    }
  }
}

// Committed artifacts that carry our banner but that this run did not write.
// Only meaningful after a FULL build — given an explicit path list, every other
// shader's artifacts are "not written" for the ordinary reason.
function assertNoOrphans(written: ReadonlySet<string>) {
  const orphans = walk(PROJECT_ROOT, '.generated.ts')
    .filter(p => !written.has(p))
    .filter(p => readFileSync(p, 'utf8').startsWith(BANNER))
  if (orphans.length > 0) {
    throw new Error(
      `${orphans.length} generated file(s) that no .slang produces:\n${orphans
        .map(p => `  ${rel(p)}`)
        .join(
          '\n',
        )}\nA renamed or deleted shader, or a dropped //! layout-out / ` +
        `consts-out / js-export-out. The file is still committed and still ` +
        `imported, and it will never be regenerated again — delete it, or ` +
        `restore the directive that owned it.`,
    )
  }
}

// The lift report's consumer scan reads every .ts in the tree; a watch session
// rereads only the files whose mtime moved.
const consumerTexts = new Map<string, { mtimeMs: number; text: string }>()
function readConsumers() {
  return [...walk(PROJECT_ROOT, '.ts'), ...walk(PROJECT_ROOT, '.tsx')]
    .filter(p => !p.endsWith('.generated.ts'))
    .map(p => {
      const { mtimeMs } = statSync(p)
      let entry = consumerTexts.get(p)
      if (entry?.mtimeMs !== mtimeMs) {
        entry = { mtimeMs, text: readFileSync(p, 'utf8') }
        consumerTexts.set(p, entry)
      }
      return { path: rel(p), text: entry.text }
    })
}

interface BuildOptions {
  paths: string[]
  useCache: boolean
  validators: Validators
}

async function build({ paths: argPaths, useCache, validators }: BuildOptions) {
  const started = performance.now()
  const resolveImports = createImportResolver(SHARED_INCLUDE)
  const paths = argPaths.length > 0 ? argPaths : walk(PROJECT_ROOT, '.slang')
  const files: ShaderFile[] = paths.map(p => {
    const source = readFileSync(p, 'utf8')
    return { path: p, source, imports: resolveImports(p, source) }
  })
  assertOutPathsUnique(files)
  const toolHash = hashOwnSources()
  const keyOf = (stamp: string) =>
    createHash('sha256')
      .update(`${toolHash}\0${JSON.stringify(validators)}\0${stamp}`)
      .digest('hex')
      .slice(0, 32)
  // Leave a couple of cores for everything else on the machine (and for this
  // process, which does the codegen between spawns).
  const limit = Math.max(1, availableParallelism() - 2)
  const results = new Map<string, FileResult>()
  const usedKeys = new Set<string>()
  const claimed = new Set<string>()
  let compiled = 0

  const failures = await pool(files, limit, async file => {
    const slangRel = rel(file.path)
    const stamp = stampOf(file)
    const key = keyOf(stamp)
    usedKeys.add(key)
    const hit = useCache ? readCached(key, stamp) : undefined
    if (hit) {
      for (const a of hit.artifacts) {
        claimed.add(path.join(PROJECT_ROOT, a))
      }
      results.set(file.path, hit)
      return
    }
    compiled++
    const lines: string[] = [slangRel]
    const ctx: FileContext = {
      log: line => lines.push(line),
      slangRel,
      stamp,
      tools: await openToolchain(validators),
      claimed,
      result: {
        artifacts: [],
        exported: [],
        uniformBlocksCompared: 0,
        dprShaders: 0,
      },
    }
    let done = false
    try {
      await (isModuleFile(file.source)
        ? emitModuleArtifacts(ctx, file)
        : compileOne(ctx, file))
      results.set(file.path, ctx.result)
      writeCached(key, ctx.result)
      done = true
    } finally {
      // What landed prints even when the compile threw, so the failure report
      // at the end reads against it. A file that rewrote nothing prints
      // nothing.
      if (!done || lines.length > 1) {
        console.log(lines.join('\n'))
      }
    }
  })

  if (failures.length > 0) {
    for (const { item, error } of failures) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`\n${rel(item.path)}: ${message}`)
    }
    throw new Error(
      `${failures.length} of ${files.length} .slang file(s) failed`,
    )
  }
  const all = files.map(f => results.get(f.path)!)
  // Before the whole-tree block below, because a scoped run compiling two
  // members of one group is a real comparison and gets to make it. What a
  // scoped run cannot see is the shader it did NOT compile — the stale
  // generated module left behind by regenerating a subset — so the count is a
  // tree-wide claim even though the comparison is not.
  const sharedStructs = assertSharedUniformBlocksAgree(
    all.flatMap(r => (r.uniformBlock ? [r.uniformBlock] : [])),
  )
  // Whole-tree claims, so meaningful only after a FULL build. Given an
  // explicit path list the scan covers those shaders alone, and writing the
  // report from it would delete every other shader's rows.
  if (argPaths.length === 0) {
    const uniformBlocksCompared = all.reduce(
      (n, r) => n + r.uniformBlocksCompared,
      0,
    )
    if (uniformBlocksCompared === 0) {
      throw new Error(
        `no shader's uniform block was compared against its emitted source. ` +
          `Every shader in the tree read as "Slang eliminated the block", which ` +
          `one shader legitimately can be and all of them cannot — slangc has ` +
          `changed how it declares a uniform block, and assertUniformLayout.ts's ` +
          `patterns need updating before the layout is trusted again.`,
      )
    }
    console.log(
      `  ok: ${uniformBlocksCompared} uniform block(s) agree with their emitted layout`,
    )
    const dprShaders = all.reduce((n, r) => n + r.dprShaders, 0)
    if (dprShaders === 0) {
      throw new Error(
        `no shader was found to convert CSS px to device px, so the ` +
          `devicePixelRatio check compared nothing. Nine did when it landed ` +
          `— every arc pass, both capsule consumers, both point-glyph ` +
          `consumers — so this means slangc stopped emitting those calls ` +
          `under the names assertDprDeclared matches, and a shader can now ` +
          `antialias against a constant unnoticed.`,
      )
    }
    assertNoDeadDprUniform(all.flatMap(r => (r.dprUse ? [r.dprUse] : [])))
    console.log(
      `  ok: ${dprShaders} shader(s) converting CSS px to device px declare the ratio`,
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
    assertNoOrphans(claimed)
    const scans = all.flatMap(r => (r.scan ? [r.scan] : []))
    const exported = new Set(all.flatMap(r => r.exported))
    // Skips come from every file, modules included — see `collectSkips`.
    const skips = collectSkips(
      files.map(f => ({ shader: rel(f.path), skips: parseJsSkips(f.source) })),
    )
    assertJsSkipsResolve(scans, exported, skips)
    if (
      writeIfChanged(
        path.join(PROJECT_ROOT, LIFT_REPORT_PATH),
        emitLiftReport(
          scans,
          exported,
          skips,
          collectExportUses(readConsumers(), exported),
        ),
      )
    ) {
      console.log(`  ok: ${LIFT_REPORT_PATH}`)
    }
    if (useCache) {
      pruneCache(usedKeys)
    }
  } else {
    // Say so, rather than skipping in silence: a shader edit that adds a
    // Candidates row would then produce no local signal at all, surfacing
    // hours later as a red CI job.
    console.log(
      `\nnote: ${LIFT_REPORT_PATH} was NOT updated — it is a whole-tree ` +
        `artifact and this run was scoped to ${argPaths.length} path(s). Run ` +
        `\`pnpm gen:shaders\` with no arguments before committing.`,
    )
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(
    `${files.length} .slang file(s) in ${seconds}s: ${compiled} compiled, ` +
      `${files.length - compiled} unchanged`,
  )
}

/**
 * Every way the committed artifacts can disagree with the sources, found by
 * hashing the sources again: no slangc, no compile, well under a second. A
 * failed compile leaves its old artifacts behind, and this is what notices.
 */
function staleArtifacts() {
  const resolveImports = createImportResolver(SHARED_INCLUDE)
  const stamps = new Map<string, string>()
  const problems = new Map<string, string[]>()
  const note = (slangRel: string, problem: string) => {
    problems.set(slangRel, [...(problems.get(slangRel) ?? []), problem])
  }
  for (const p of walk(PROJECT_ROOT, '.slang')) {
    const source = readFileSync(p, 'utf8')
    stamps.set(
      rel(p),
      stampOf({ path: p, source, imports: resolveImports(p, source) }),
    )
    const own = path.join(
      path.dirname(p),
      `${path.basename(p, '.slang')}.generated.ts`,
    )
    if (!isModuleFile(source) && !existsSync(own)) {
      note(rel(p), `${rel(own)} does not exist`)
    }
  }
  for (const p of walk(PROJECT_ROOT, '.generated.ts')) {
    const text = readFileSync(p, 'utf8')
    if (!text.startsWith(BANNER)) {
      continue
    }
    const stamp = readStamp(text)
    if (!stamp) {
      note(rel(p), 'carries no inputs stamp')
    } else if (!stamps.has(stamp.slangPath)) {
      note(stamp.slangPath, `no longer exists, and ${rel(p)} came from it`)
    } else if (stamps.get(stamp.slangPath) !== stamp.hash) {
      note(stamp.slangPath, 'changed since its generated files were made')
    }
  }
  return problems
}

function check() {
  const problems = staleArtifacts()
  if (problems.size === 0) {
    console.log('Every generated shader artifact is current.')
    return
  }
  const lines = [...problems].flatMap(([slangRel, list]) => [
    slangRel,
    ...[...new Set(list)].map(p => `  ${p}`),
  ])
  fail(
    `${problems.size} shader source(s) disagree with their generated ` +
      `files:\n\n${lines.join('\n')}\n\nRun \`pnpm gen:shaders\`. If it ` +
      `already ran, it failed on these: its output says why.`,
  )
}

async function watchBuild(options: BuildOptions) {
  const watched = new Set<string>()
  const buildOnce = async () => {
    try {
      await build(options)
    } catch (e) {
      console.error(
        `\ngen:shaders failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
    // A new shader directory is watched from the build that found it.
    for (const dir of new Set([
      SHARED_INCLUDE,
      ...walk(PROJECT_ROOT, '.slang').map(p => path.dirname(p)),
    ])) {
      if (!watched.has(dir)) {
        watched.add(dir)
        watch(dir, (_event, name) => {
          if (name?.endsWith('.slang')) {
            schedule()
          }
        })
      }
    }
    console.log('\nwatching for .slang changes')
  }
  // Builds run one at a time. A save during a build queues one more, and a
  // save while that one still waits to start joins it.
  let queue = buildOnce()
  let queued = false
  let timer: NodeJS.Timeout | undefined
  // An editor's save is several events; one build answers them all.
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!queued) {
        queued = true
        queue = queue.then(() => {
          queued = false
          return buildOnce()
        })
      }
    }, 100)
  }
  await queue
}

try {
  if (hasFlag('check')) {
    check()
  } else {
    const options: BuildOptions = {
      paths: ARGS.filter(a => !a.startsWith('--')),
      useCache: !hasFlag('no-cache'),
      validators: {
        tint: tintInstalled(),
        glslang: resolveValidator(
          process.env.GLSLANG ?? 'glslangValidator',
          'glslangValidator',
        ),
      },
    }
    if (hasFlag('watch')) {
      await watchBuild(options)
    } else {
      await build(options)
    }
  }
} catch (e) {
  // run() already put the tool's diagnostic in the Error message; print just
  // that (no Node stack / raw Buffer dump) and fail the build.
  fail(e instanceof Error ? e.message : String(e))
}
