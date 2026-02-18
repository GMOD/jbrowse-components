import { createHash } from 'crypto'
import { execSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { wiggleShader } from '../src/LinearWebGLWiggleDisplay/components/wiggleShaders.ts'
import { multiWiggleShader } from '../src/LinearWebGLMultiWiggleDisplay/components/multiWiggleShaders.ts'

const shaders = [
  { name: 'WIGGLE', wgsl: wiggleShader },
  { name: 'MULTI_WIGGLE', wgsl: multiWiggleShader },
] as const

const outDir = join(
  import.meta.dirname,
  '..',
  'src',
  'shared',
  'generated',
)
const outFile = join(outDir, 'index.ts')
const hashFile = join(outDir, '.wgsl-hash')

interface StructField {
  type: string
  name: string
}

function hasNaga() {
  try {
    execSync('naga --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function computeSourceHash() {
  const allWgsl = shaders.map(s => s.wgsl).join('\n')
  return createHash('sha256').update(allWgsl).digest('hex')
}

function isUpToDate(hash: string) {
  if (!existsSync(outFile) || !existsSync(hashFile)) {
    return false
  }
  try {
    return readFileSync(hashFile, 'utf-8').trim() === hash
  } catch {
    return false
  }
}

function parseStruct(glsl: string, structName: string): StructField[] {
  const re = new RegExp(`struct\\s+${structName}\\s*\\{([^}]+)\\}`)
  const m = re.exec(glsl)
  if (!m) {
    return []
  }
  const fields: StructField[] = []
  for (const line of m[1].split(';')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      fields.push({ type: parts[0], name: parts[1] })
    }
  }
  return fields
}

function fetchExpr(type: string, baseExpr: string) {
  if (type === 'float') {
    return `uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4])`
  }
  if (type === 'uint') {
    return `texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4]`
  }
  if (type === 'int') {
    return `int(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4])`
  }
  if (type === 'uvec2') {
    return `uvec2(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4], texelFetch(u_instanceData, ivec2((${baseExpr} + 1) / 4, 0), 0)[(${baseExpr} + 1) % 4])`
  }
  if (type === 'vec4') {
    return `vec4(uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4]), uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr} + 1) / 4, 0), 0)[(${baseExpr} + 1) % 4]), uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr} + 2) / 4, 0), 0)[(${baseExpr} + 2) % 4]), uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr} + 3) / 4, 0), 0)[(${baseExpr} + 3) % 4]))`
  }
  throw new Error(`Unsupported type in SSBO struct: ${type}`)
}

function fieldSize(type: string) {
  if (type === 'uvec2' || type === 'vec2' || type === 'ivec2') {
    return 2
  }
  if (type === 'vec3' || type === 'uvec3' || type === 'ivec3') {
    return 3
  }
  if (type === 'vec4' || type === 'uvec4' || type === 'ivec4') {
    return 4
  }
  return 1
}

function replaceSSBO(glsl: string) {
  const ssboRe =
    /layout\(std430\)\s+readonly\s+buffer\s+\w+\s*\{\s*(\w+)\s+(\w+)\[\]\s*;\s*\}\s*;/
  const ssboMatch = ssboRe.exec(glsl)
  if (!ssboMatch) {
    return glsl
  }

  const structType = ssboMatch[1]
  const arrayName = ssboMatch[2]
  const fields = parseStruct(glsl, structType)
  if (fields.length === 0) {
    throw new Error(`Could not parse struct ${structType}`)
  }

  let stride = 0
  const offsets: number[] = []
  for (const f of fields) {
    offsets.push(stride)
    stride += fieldSize(f.type)
  }

  let fetchFn = `${structType} _fetch_${structType}(int idx) {\n`
  fetchFn += `    int base = idx * ${stride};\n`
  fetchFn += `    ${structType} s;\n`
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    fetchFn += `    s.${f.name} = ${fetchExpr(f.type, `base + ${offsets[i]}`)};\n`
  }
  fetchFn += `    return s;\n`
  fetchFn += `}`

  glsl = glsl.replace(
    ssboMatch[0],
    `uniform highp usampler2D u_instanceData;\n\n${fetchFn}`,
  )

  const accessRe = new RegExp(
    `(\\w+)\\s+(\\w+)\\s*=\\s*${arrayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[([^\\]]+)\\]\\s*;`,
    'g',
  )
  glsl = glsl.replace(accessRe, (_match, type, varName, indexExpr) => {
    return `${type} ${varName} = _fetch_${type}(int(${indexExpr}));`
  })

  return glsl
}

function postProcess(glsl: string) {
  glsl = glsl.replace('#version 310 es', '#version 300 es')
  glsl = glsl.replace(/uniform uint naga_vs_first_instance;\n?/g, '')
  glsl = glsl.replace(
    /\(uint\(gl_InstanceID\)\s*\+\s*naga_vs_first_instance\)/g,
    'uint(gl_InstanceID)',
  )
  glsl = replaceSSBO(glsl)
  return glsl
}

function compileShader(
  wgsl: string,
  entryPoint: string,
  stage: 'vert' | 'frag',
  tmpDir: string,
  name: string,
) {
  const wgslPath = join(tmpDir, `${name}.wgsl`)
  const outPath = join(tmpDir, `${name}.${stage}`)
  writeFileSync(wgslPath, wgsl)
  try {
    execSync(
      `naga "${wgslPath}" "${outPath}" --entry-point ${entryPoint} --keep-coordinate-space --compact`,
      { stdio: 'pipe' },
    )
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer }
    console.error(`naga failed for ${name} ${stage}:`)
    console.error(err.stderr?.toString())
    throw e
  }
  return postProcess(readFileSync(outPath, 'utf-8'))
}

function main() {
  const hash = computeSourceHash()
  if (isUpToDate(hash)) {
    console.log('compile-shaders: GLSL is up to date, skipping')
    return
  }
  if (!hasNaga()) {
    if (existsSync(outFile)) {
      console.warn(
        'compile-shaders: naga not found, using existing generated GLSL',
      )
      return
    }
    console.error(
      'compile-shaders: naga not found and no generated GLSL exists.',
    )
    console.error('Install naga-cli: cargo install naga-cli')
    process.exit(1)
  }

  const tmpDir = join(tmpdir(), `jbrowse-wiggle-shader-compile-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  const results: { name: string; vert: string; frag: string }[] = []
  for (const shader of shaders) {
    process.stdout.write(`  ${shader.name}...`)
    const vert = compileShader(shader.wgsl, 'vs_main', 'vert', tmpDir, shader.name)
    const frag = compileShader(shader.wgsl, 'fs_main', 'frag', tmpDir, shader.name)
    results.push({ name: shader.name, vert, frag })
    process.stdout.write(' ok\n')
  }

  mkdirSync(outDir, { recursive: true })

  let output = '// Auto-generated by compile-shaders.ts from WGSL sources\n'
  output += '// Do not edit manually - edit the WGSL sources instead\n'
  output += '// Regenerate: pnpm compile-shaders\n\n'

  for (const r of results) {
    output += `export const ${r.name}_VERTEX_SHADER = \`${r.vert.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`\n\n`
    output += `export const ${r.name}_FRAGMENT_SHADER = \`${r.frag.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`\n\n`
  }

  writeFileSync(outFile, output)
  writeFileSync(hashFile, hash)
  rmSync(tmpDir, { recursive: true })
  console.log(`compile-shaders: generated ${results.length} shader pairs → ${outFile}`)
}

main()
