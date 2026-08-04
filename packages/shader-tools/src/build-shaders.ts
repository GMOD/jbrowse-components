#!/usr/bin/env node
/* eslint-disable no-console */
// Compiles every `*.slang` source file in the workspace into its matching
// `*.generated.ts` artifact. Emits WGSL + GLSL-ES-300 shader strings and a
// reflection-derived TS layout (stride, field offsets, typed packer,
// GL_ATTRIBUTES). The generated file is the single source of truth for all
// per-shader buffer layouts; TS callers import its constants instead of
// hand-maintaining parallel stride/offset declarations.
//
// A `.slang` file may declare targets via a leading comment:
//   //! targets: wgsl, glsl
//   //! targets: wgsl           (compute shaders, WebGPU-only)
// Default: wgsl + glsl.
//
// Module files (those whose Slang source begins with `module <name>;`) are
// treated as imports only. If a module declares `//! export-consts: A, B`
// it emits a `<base>.generated.ts` with just those constant values.
//
// Two directives write a second artifact at a repo-relative path, for a package
// that can't import the plugin owning the shader:
//   //! layout-out: <path>   instance stride + field offsets only
//   //! consts-out: <path>   the `export-consts` values only
import { execFileSync, spawnSync } from 'node:child_process'
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
import { tmpdir } from 'node:os'
import path from 'node:path'

import { assertVertexInputsMatch } from './shader-codegen/assertVertexInputs.ts'
import {
  emitConsts,
  emitInterface,
  emitLayoutOnly,
  emitShaderStrings,
  instanceAttrsFor,
} from './shader-codegen/codegen.ts'
import {
  parseConstsOut,
  parseExportedConsts,
  parseJsExportOut,
  parseJsExports,
  parseLayoutOut,
  parseTargets,
  parseVertsPerInstance,
} from './shader-codegen/parseDirectives.ts'
import { vulkanGlslToWebgl2 } from './shader-codegen/vulkanGlslToWebgl2.ts'
import { emitJsTwins } from './shader-codegen/wgslToJs.ts'

import type { JsExportFn } from './shader-codegen/parseDirectives.ts'

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
    throw new Error(
      `Could not find the shared .slang modules. Looked in:\n` +
        candidates.map(c => `  ${c}`).join('\n') +
        `\nInstall @jbrowse/render-core, or pass --shared-include=<dir>.`,
    )
  }
  return found
}
const SHARED_INCLUDE = resolveSharedInclude()

function ensureSlangc() {
  if (process.env.SLANGC) {
    return process.env.SLANGC
  }
  const ver = SLANG_VERSION.replace(/^v/, '')
  if (existsSync(SLANGC_CACHE)) {
    const { stderr } = spawnSync(SLANGC_CACHE, ['-v'], { encoding: 'utf8' })
    if (stderr.trim() === ver) {
      return SLANGC_CACHE
    }
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
// spawnSync (vs execFileSync) keeps the tool's stderr as a decoded string rather
// than throwing an exception whose Buffer fields dump as raw byte arrays — so a
// shader compile error reads as the compiler's own message, file:line and all.
function run(bin: string, args: string[]) {
  const { error, status, signal, stderr } = spawnSync(bin, args, {
    encoding: 'utf8',
  })
  if (error) {
    throw new Error(`${path.basename(bin)}: ${error.message}`)
  }
  if (status !== 0) {
    const how = signal ? `killed by ${signal}` : `exited with ${status}`
    throw new Error(`${path.basename(bin)} ${how}\n\n${stderr.trim()}`)
  }
}

function walk(dir: string, out: string[] = []) {
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
      walk(fullPath, out)
    } else if (entry.endsWith('.slang')) {
      out.push(fullPath)
    }
  }
  return out
}

// A module declares `module <name>;` and has no entry points — it is compiled
// only as an import. The `[shader(` probe strips line comments first: several
// modules discuss the passes that import them, and a mention in prose would
// otherwise make the driver try to compile a module as a standalone shader.
// Write a `//! layout-out` / `//! consts-out` artifact at a repo-relative path.
// Both exist so a package that can't import the owning plugin still gets its
// numbers from the shader rather than a hand-kept SYNC copy.
function writeOut(relPath: string, contents: string) {
  writeFileSync(path.join(PROJECT_ROOT, relPath), contents)
  console.log(`  ok: ${relPath}`)
}

function writeConstsOut(
  source: string,
  base: string,
  exportedConsts: Record<string, number> | undefined,
) {
  const constsOut = parseConstsOut(source)
  if (!constsOut) {
    return
  }
  if (!exportedConsts) {
    throw new Error(
      `//! consts-out needs a //! export-consts directive naming what to write`,
    )
  }
  writeOut(constsOut, emitConsts(base, exportedConsts))
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
    const asFloat =
      fn.returnType === 'float'
        ? call
        : fn.returnType === 'bool'
          ? `(${call} ? 1.0 : 0.0)`
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
  const m = /^\s*module\s+(\w+)\s*;/m.exec(source.replaceAll(/\/\/[^\n]*/g, ''))
  if (!m) {
    throw new Error(`${slangPath}: //! js-export needs a 'module <name>;' file`)
  }
  return m[1]!
}

// A module's functions are only reachable through an import, so its WGSL has to
// be conjured by the wrapper above.
function compileJsExportWrapper(
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
    run(SLANGC, [
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
function writeJsExports(
  slangPath: string,
  source: string,
  base: string,
  shaderWgsl?: string,
) {
  const fns = parseJsExports(source)
  if (!fns) {
    return
  }
  const wgsl =
    shaderWgsl ?? compileJsExportWrapper(slangPath, source, base, fns)
  const contents = emitJsTwins(
    base,
    wgsl,
    fns.map(f => f.name),
    [
      `// AUTO-GENERATED by packages/shader-tools/src/shader-codegen from ${base}.slang.`,
      '// Do not edit. Run `pnpm gen:shaders` to regenerate.',
      '',
    ],
  )
  const out = parseJsExportOut(source)
  if (out) {
    writeOut(out, contents)
    return
  }
  const generatedPath = path.join(
    path.dirname(slangPath),
    `${base}.js.generated.ts`,
  )
  writeFileSync(generatedPath, contents)
  console.log(`  ok: ${generatedPath.replace(`${PROJECT_ROOT}/`, '')}`)
}

function isModuleFile(source: string) {
  const code = source.replaceAll(/\/\/[^\n]*/g, '')
  return /^\s*module\s+\w+\s*;/m.test(code) && !code.includes('[shader(')
}

// Sources of every module a shader `import`s, transitively, resolved against
// the same include path slangc gets. The constant evaluator reads these so a
// shader can write `CURVE_SEGMENTS * 6u` instead of the product spelled out —
// Slang resolves the identifier, and until this existed the codegen could not,
// which is what forced the literal-plus-SYNC-comment pattern.
function readImportedSources(
  slangPath: string,
  source: string,
  seen = new Set<string>(),
): string[] {
  const dir = path.dirname(slangPath)
  const code = source.replaceAll(/\/\/[^\n]*/g, '')
  const out: string[] = []
  for (const m of code.matchAll(/^\s*import\s+(\w+)\s*;/gm)) {
    const found = [dir, SHARED_INCLUDE]
      .map(d => path.join(d, `${m[1]!}.slang`))
      .find(p => existsSync(p))
    if (!found || seen.has(found)) {
      continue
    }
    seen.add(found)
    const imported = readFileSync(found, 'utf8')
    out.push(imported, ...readImportedSources(found, imported, seen))
  }
  return out
}

function findVertexStructMeta(reflection: {
  entryPoints: {
    name: string
    stage: string
    parameters: {
      name: string
      type: { kind: string; name?: string; fields?: { name: string }[] }
    }[]
  }[]
  parameters: {
    name: string
    type: { kind: string; elementType?: { name?: string } }
  }[]
}) {
  const vs = reflection.entryPoints.find(e => e.stage === 'vertex')
  if (!vs) {
    return undefined
  }
  for (const p of vs.parameters) {
    if (p.type.kind === 'struct' && p.type.fields) {
      return {
        prefix: p.name,
        fieldNames: p.type.fields.map(f => f.name),
      }
    }
  }
  return undefined
}

function findUniformBlockName(reflection: {
  parameters: { type: { kind: string; elementType?: { name?: string } } }[]
}) {
  for (const p of reflection.parameters) {
    if (p.type.kind === 'constantBuffer' && p.type.elementType?.name) {
      return `block_${p.type.elementType.name}_0`
    }
  }
  return undefined
}

function findEntryPoint(
  reflection: { entryPoints: { name: string; stage: string }[] },
  stage: 'vertex' | 'fragment' | 'compute',
) {
  return reflection.entryPoints.find(e => e.stage === stage)?.name
}

function findVaryingFieldNames(reflection: {
  entryPoints: {
    stage: string
    result?: {
      type?: {
        kind: string
        fields?: { name: string; binding?: { kind: string } }[]
      }
    }
  }[]
}): string[] {
  const vs = reflection.entryPoints.find(e => e.stage === 'vertex')
  const t = vs?.result?.type
  if (t?.kind !== 'struct' || !t.fields) {
    return []
  }
  return t.fields
    .filter(f => f.binding?.kind === 'varyingOutput')
    .map(f => f.name)
}

function findFragmentInputParamName(reflection: {
  entryPoints: {
    stage: string
    parameters: { name: string; type: { kind: string } }[]
  }[]
}) {
  const fs = reflection.entryPoints.find(e => e.stage === 'fragment')
  if (!fs) {
    return undefined
  }
  return fs.parameters.find(p => p.type.kind === 'struct')?.name
}

// Combined `Sampler2D<T>` declarations. Each one consumes two WebGPU binding
// slots (texture at N, sampler at N+1) and emits a single `sampler2D` in
// GLSL. Returns the shader-author's original name alongside both bindings so
// the TS side can wire up TextureBinding{textureBinding, samplerBinding,
// glUniformName}.
interface ReflectionTexture {
  name: string
  textureBinding: number
  samplerBinding: number
}
function findCombinedSamplers(reflection: {
  parameters: {
    name: string
    binding?: { kind: string; index?: number; count?: number }
    type?: { kind?: string; baseShape?: string; combined?: boolean }
  }[]
}): ReflectionTexture[] {
  const out: ReflectionTexture[] = []
  for (const p of reflection.parameters) {
    if (
      p.type?.kind === 'resource' &&
      p.type.baseShape === 'texture2D' &&
      p.type.combined &&
      p.binding?.kind === 'descriptorTableSlot' &&
      typeof p.binding.index === 'number'
    ) {
      out.push({
        name: p.name,
        textureBinding: p.binding.index,
        samplerBinding: p.binding.index + 1,
      })
    }
  }
  return out
}

function compileOne(slangPath: string) {
  const source = readFileSync(slangPath, 'utf8')
  if (isModuleFile(source)) {
    return
  }
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
    run(SLANGC, slangcArgs)
    const wgsl = readFileSync(wgslOut, 'utf8')
    if (NAGA) {
      run(NAGA, [wgslOut])
    }

    const reflection = JSON.parse(readFileSync(reflectionOut, 'utf8'))
    let glslVertex: string | undefined
    let glslFragment: string | undefined

    if (targets.includes('glsl')) {
      const vsName = findEntryPoint(reflection, 'vertex')
      const fsName = findEntryPoint(reflection, 'fragment')
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
      run(SLANGC, glslArgs('vertex', vsName, glslVertexOut))
      run(SLANGC, glslArgs('fragment', fsName, glslFragmentOut))

      const attributes = findVertexStructMeta(reflection)
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
        run(GLSLANG, ['-S', 'vert', processedVertOut])
        run(GLSLANG, ['-S', 'frag', processedFragOut])
      }
    }

    // Fail here, before writing, if slangc's `@location` assignment disagrees
    // with the tight-packed layout the generated packers assume.
    const attrs = instanceAttrsFor(reflection)
    if (attrs) {
      assertVertexInputsMatch(path.relative(PROJECT_ROOT, slangPath), attrs, {
        wgsl,
        glslVertex,
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
    }
    const generatedPath = path.join(dir, `${base}.generated.ts`)
    writeFileSync(generatedPath, emitShaderStrings(codegenInputs))
    const ifacePath = path.join(dir, `${base}.iface.generated.ts`)
    writeFileSync(ifacePath, emitInterface(codegenInputs))
    console.log(`  ok: ${generatedPath.replace(`${PROJECT_ROOT}/`, '')}`)
    console.log(`  ok: ${ifacePath.replace(`${PROJECT_ROOT}/`, '')}`)

    const layoutOut = parseLayoutOut(source)
    if (layoutOut) {
      writeOut(layoutOut, emitLayoutOnly({ baseName: base, reflection }))
    }
    writeConstsOut(source, base, codegenInputs.exportedConsts)
    writeJsExports(slangPath, source, base, wgsl)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function main() {
  const argPaths = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const paths = argPaths.length > 0 ? argPaths : walk(PROJECT_ROOT)
  console.log(`Found ${paths.length} .slang file(s)`)
  for (const p of paths) {
    const source = readFileSync(p, 'utf8')
    if (isModuleFile(source)) {
      const exportedConsts = parseExportedConsts(
        source,
        readImportedSources(p, source),
      )
      const base = path.basename(p, '.slang')
      if (exportedConsts) {
        const generatedPath = path.join(path.dirname(p), `${base}.generated.ts`)
        writeFileSync(generatedPath, emitConsts(base, exportedConsts))
        console.log(`  ok: ${generatedPath.replace(`${PROJECT_ROOT}/`, '')}`)
      }
      writeConstsOut(source, base, exportedConsts)
      writeJsExports(p, source, base)
      continue
    }
    console.log(p.replace(`${PROJECT_ROOT}/`, ''))
    compileOne(p)
  }
}

try {
  main()
} catch (e) {
  // run() already put the tool's diagnostic in the Error message; print just
  // that (no Node stack / raw Buffer dump) and fail the build.
  console.error(`\ngen:shaders failed: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}
