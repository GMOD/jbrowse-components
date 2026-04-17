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

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import { emit as emitLayout } from './shader-codegen/codegen.ts'
import { vulkanGlslToWebgl2 } from './shader-codegen/vulkanGlslToWebgl2.ts'

const REPO_ROOT = resolve(dirname(import.meta.url.replace('file://', '')), '..')
const SLANGC = process.env.SLANGC ?? `${REPO_ROOT}/.cache/slangc/bin/slangc`
const NAGA = process.env.NAGA ?? 'naga'
const GLSLANG = process.env.GLSLANG ?? 'glslangValidator'

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
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path, out)
    } else if (entry.endsWith('.slang')) {
      out.push(path)
    }
  }
  return out
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
  return /^\s*module\s+\w+\s*;/m.test(source) && !/\[shader\(/.test(source)
}

function findVertexStructMeta(reflection: {
  entryPoints: Array<{
    name: string
    stage: string
    parameters: Array<{
      name: string
      type: { kind: string; name?: string; fields?: Array<{ name: string }> }
    }>
  }>
  parameters: Array<{
    name: string
    type: { kind: string; elementType?: { name?: string } }
  }>
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
  parameters: Array<{ type: { kind: string; elementType?: { name?: string } } }>
}) {
  for (const p of reflection.parameters) {
    if (p.type.kind === 'constantBuffer' && p.type.elementType?.name) {
      return `block_${p.type.elementType.name}_0`
    }
  }
  return undefined
}

function findEntryPoint(
  reflection: { entryPoints: Array<{ name: string; stage: string }> },
  stage: 'vertex' | 'fragment' | 'compute',
) {
  return reflection.entryPoints.find(e => e.stage === stage)?.name
}

function findVaryingFieldNames(reflection: {
  entryPoints: Array<{
    stage: string
    result?: {
      type?: { kind: string; fields?: Array<{ name: string; binding?: { kind: string } }> }
    }
  }>
}): string[] {
  const vs = reflection.entryPoints.find(e => e.stage === 'vertex')
  const t = vs?.result?.type
  if (!t || t.kind !== 'struct' || !t.fields) {
    return []
  }
  return t.fields
    .filter(f => f.binding?.kind === 'varyingOutput')
    .map(f => f.name)
}

function findFragmentInputParamName(reflection: {
  entryPoints: Array<{
    stage: string
    parameters: Array<{ name: string; type: { kind: string } }>
  }>
}) {
  const fs = reflection.entryPoints.find(e => e.stage === 'fragment')
  if (!fs) {
    return undefined
  }
  return fs.parameters.find(p => p.type.kind === 'struct')?.name
}

function compileOne(slangPath: string) {
  const source = readFileSync(slangPath, 'utf8')
  if (isModuleFile(source)) {
    return
  }
  const targets = parseTargets(source)
  const base = basename(slangPath, '.slang')
  const dir = dirname(slangPath)
  const tmp = mkdtempSync(join(tmpdir(), `build-shaders-${base}-`))
  try {
    const wgslOut = join(tmp, `${base}.wgsl`)
    const reflectionOut = join(tmp, `${base}.reflection.json`)

    const slangcArgs = [slangPath, '-target', 'wgsl', '-o', wgslOut, '-reflection-json', reflectionOut, '-I', dir]
    execFileSync(SLANGC, slangcArgs, { stdio: 'pipe' })
    const wgsl = readFileSync(wgslOut, 'utf8')
    execFileSync(NAGA, [wgslOut], { stdio: 'pipe' })

    const reflection = JSON.parse(readFileSync(reflectionOut, 'utf8'))
    let glslVertex: string | undefined
    let glslFragment: string | undefined

    if (targets.includes('glsl')) {
      const vsName = findEntryPoint(reflection, 'vertex')
      const fsName = findEntryPoint(reflection, 'fragment')
      if (!vsName || !fsName) {
        throw new Error(`${slangPath}: targets 'glsl' but missing vertex or fragment entry point`)
      }
      const glslVertexOut = join(tmp, `${base}.vert.glsl`)
      const glslFragmentOut = join(tmp, `${base}.frag.glsl`)
      execFileSync(
        SLANGC,
        [slangPath, '-target', 'glsl', '-stage', 'vertex', '-entry', vsName, '-o', glslVertexOut, '-I', dir],
        { stdio: 'pipe' },
      )
      execFileSync(
        SLANGC,
        [slangPath, '-target', 'glsl', '-stage', 'fragment', '-entry', fsName, '-o', glslFragmentOut, '-I', dir],
        { stdio: 'pipe' },
      )

      const attributes = findVertexStructMeta(reflection)
      const uniformBlockName = findUniformBlockName(reflection)
      const varyingFieldNames = findVaryingFieldNames(reflection)
      const fragParamName = findFragmentInputParamName(reflection)

      const rawVert = readFileSync(glslVertexOut, 'utf8')
      const rawFrag = readFileSync(glslFragmentOut, 'utf8')
      glslVertex = vulkanGlslToWebgl2(rawVert, 'vertex', {
        uniformBlockName,
        attributes,
        varyings:
          varyingFieldNames.length > 0
            ? { prefix: `entryPointParam_${vsName}`, fieldNames: varyingFieldNames }
            : undefined,
      })
      glslFragment = vulkanGlslToWebgl2(rawFrag, 'fragment', {
        uniformBlockName,
        attributes,
        varyings:
          varyingFieldNames.length > 0 && fragParamName
            ? { prefix: fragParamName, fieldNames: varyingFieldNames }
            : undefined,
      })

      const processedVertOut = join(tmp, `${base}.vert.es.glsl`)
      const processedFragOut = join(tmp, `${base}.frag.es.glsl`)
      writeFileSync(processedVertOut, glslVertex)
      writeFileSync(processedFragOut, glslFragment)
      execFileSync(GLSLANG, ['-S', 'vert', processedVertOut], { stdio: 'pipe' })
      execFileSync(GLSLANG, ['-S', 'frag', processedFragOut], { stdio: 'pipe' })
    }

    const generatedPath = join(dir, `${base}.generated.ts`)
    const generated = emitLayout({
      baseName: base,
      reflection,
      wgsl,
      glslVertex,
      glslFragment,
    })
    writeFileSync(generatedPath, generated)
    console.log(`  ok: ${generatedPath.replace(REPO_ROOT + '/', '')}`)
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
    console.log(p.replace(REPO_ROOT + '/', ''))
    compileOne(p)
  }
}

main()
