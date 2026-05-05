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
// treated as imports only — no codegen output for them.

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

import { emit as emitLayout, emitLayoutOnly } from './shader-codegen/codegen.ts'
import { vulkanGlslToWebgl2 } from './shader-codegen/vulkanGlslToWebgl2.ts'

const REPO_ROOT = path.resolve(
  path.dirname(import.meta.url.replace('file://', '')),
  '..',
)

const SLANG_VERSION = 'v2026.5.2'
const SLANGC_CACHE = `${REPO_ROOT}/.cache/slangc/bin/slangc`
const NAGA = process.env.NAGA ?? 'naga'
const GLSLANG = process.env.GLSLANG ?? 'glslangValidator'
// Shaders live alongside their plugin, but shared modules (hpmath, etc.) live
// in core so any shader can `import hpmath;`.
const SHARED_INCLUDE = path.resolve(REPO_ROOT, 'packages/core/src/gpu/shaders')

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
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, out)
    } else if (entry.endsWith('.slang')) {
      out.push(fullPath)
    }
  }
  return out
}

function parseLayoutOut(source: string) {
  const match = /^\/\/!\s*layout-out:\s*(\S+)/m.exec(source)
  return match ? match[1]! : undefined
}

// Resolves the value of `(public)? static const uint VERTS_PER_INSTANCE`
// from a .slang source. Slang's reflection JSON doesn't expose module-scope
// constants, so we parse them out of the source. Other static-const ints in
// the same file are resolved as identifiers in the expression (`16u * 6` etc),
// matching how the shader itself sees them.
function parseVertsPerInstance(source: string) {
  const constRe =
    /^\s*(?:public\s+)?static\s+const\s+uint\s+(\w+)\s*=\s*([^;]+);/gm
  const decls = new Map<string, string>()
  for (let m = constRe.exec(source); m; m = constRe.exec(source)) {
    decls.set(m[1]!, m[2]!.trim())
  }
  const expr = decls.get('VERTS_PER_INSTANCE')
  if (!expr) {
    return undefined
  }
  const evaluating = new Set<string>()
  const evalExpr = (raw: string): number => {
    // Strip Slang's `u` / `U` integer suffix first so `1u` doesn't leave a
    // stray `u` that the identifier pass would fail to resolve.
    const stripped = raw.replace(/(\d+)[uU]\b/g, '$1')
    // Replace identifier references with their resolved numeric values.
    const cleaned = stripped.replace(/[A-Za-z_]\w*/g, name => {
      if (evaluating.has(name)) {
        throw new Error(`circular static-const reference: ${name}`)
      }
      const ref = decls.get(name)
      if (ref === undefined) {
        throw new Error(
          `static const VERTS_PER_INSTANCE references unknown identifier ${name}`,
        )
      }
      evaluating.add(name)
      const value = evalExpr(ref)
      evaluating.delete(name)
      return `(${value})`
    })
    if (!/^[\d\s+\-*/()]+$/.test(cleaned)) {
      throw new Error(
        `static const VERTS_PER_INSTANCE must be a positive integer ` +
          `arithmetic expression; got: ${raw} (post-substitution: ${cleaned})`,
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function(`"use strict"; return (${cleaned})`)() as number
  }
  const n = evalExpr(expr)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `static const VERTS_PER_INSTANCE must be a positive integer; got ${n}`,
    )
  }
  return n
}

function parseExportedConsts(
  source: string,
): Record<string, number> | undefined {
  const directive = /^\/\/!\s*export-consts:\s*(.+)/m.exec(source)
  if (!directive) {
    return undefined
  }
  const names = new Set(directive[1]!.split(',').map(s => s.trim()))
  const constRe =
    /^\s*(?:public\s+)?static\s+const\s+(?:float|int|uint)\s+(\w+)\s*=\s*([^;]+);/gm
  const result: Record<string, number> = {}
  for (let m = constRe.exec(source); m; m = constRe.exec(source)) {
    const name = m[1]!
    if (names.has(name)) {
      result[name] = parseFloat(m[2]!.trim())
    }
  }
  return Object.keys(result).length ? result : undefined
}

function parseTargets(source: string): ('wgsl' | 'glsl')[] {
  const match = /^\/\/!\s*targets:\s*([a-zA-Z0-9,\t ]+)/m.exec(source)
  if (!match) {
    return ['wgsl', 'glsl']
  }
  return match[1]!
    .split(',')
    .map(s => s.trim())
    .filter((s): s is 'wgsl' | 'glsl' => s === 'wgsl' || s === 'glsl')
}

function isModuleFile(source: string) {
  return /^\s*module\s+\w+\s*;/m.test(source) && !source.includes('[shader(')
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
    execFileSync(SLANGC, slangcArgs, { stdio: 'pipe' })
    const wgsl = readFileSync(wgslOut, 'utf8')
    if (NAGA) {
      execFileSync(NAGA, [wgslOut], { stdio: 'pipe' })
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
      execFileSync(
        SLANGC,
        [
          slangPath,
          '-target',
          'glsl',
          '-stage',
          'vertex',
          '-entry',
          vsName,
          '-o',
          glslVertexOut,
          '-I',
          dir,
          '-I',
          SHARED_INCLUDE,
        ],
        { stdio: 'pipe' },
      )
      execFileSync(
        SLANGC,
        [
          slangPath,
          '-target',
          'glsl',
          '-stage',
          'fragment',
          '-entry',
          fsName,
          '-o',
          glslFragmentOut,
          '-I',
          dir,
          '-I',
          SHARED_INCLUDE,
        ],
        { stdio: 'pipe' },
      )

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
      execFileSync(GLSLANG, ['-S', 'vert', processedVertOut], { stdio: 'pipe' })
      execFileSync(GLSLANG, ['-S', 'frag', processedFragOut], { stdio: 'pipe' })
    }

    const generatedPath = path.join(dir, `${base}.generated.ts`)
    const generated = emitLayout({
      baseName: base,
      reflection,
      wgsl,
      glslVertex,
      glslFragment,
      textures: findCombinedSamplers(reflection),
      vertsPerInstance: parseVertsPerInstance(source),
      exportedConsts: parseExportedConsts(source),
    })
    writeFileSync(generatedPath, generated)
    console.log(`  ok: ${generatedPath.replace(`${REPO_ROOT}/`, '')}`)

    const layoutOut = parseLayoutOut(source)
    if (layoutOut) {
      const layoutPath = path.join(REPO_ROOT, layoutOut)
      writeFileSync(layoutPath, emitLayoutOnly({ baseName: base, reflection }))
      console.log(`  ok: ${layoutOut}`)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function main() {
  const argPaths = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const paths = argPaths.length > 0 ? argPaths : walk(REPO_ROOT)
  console.log(`Found ${paths.length} .slang file(s)`)
  for (const p of paths) {
    const source = readFileSync(p, 'utf8')
    if (isModuleFile(source)) {
      continue
    }
    console.log(p.replace(`${REPO_ROOT}/`, ''))
    compileOne(p)
  }
}

main()
