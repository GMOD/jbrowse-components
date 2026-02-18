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

import { READ_WGSL } from '../src/LinearAlignmentsDisplay/components/wgsl/readShader.ts'
import {
  GAP_WGSL,
  HARDCLIP_WGSL,
  INSERTION_WGSL,
  MISMATCH_WGSL,
  MODIFICATION_WGSL,
  SOFTCLIP_WGSL,
} from '../src/LinearAlignmentsDisplay/components/wgsl/cigarShaders.ts'
import {
  COVERAGE_WGSL,
  INDICATOR_WGSL,
  MOD_COVERAGE_WGSL,
  NONCOV_HISTOGRAM_WGSL,
  SEPARATOR_LINE_WGSL,
  SNP_COVERAGE_WGSL,
} from '../src/LinearAlignmentsDisplay/components/wgsl/coverageShaders.ts'
import {
  ARC_LINE_WGSL,
  ARC_WGSL,
  CLOUD_WGSL,
  CONNECTING_LINE_WGSL,
  SASHIMI_WGSL,
} from '../src/LinearAlignmentsDisplay/components/wgsl/miscShaders.ts'

const shaders = [
  { name: 'READ', wgsl: READ_WGSL },
  { name: 'GAP', wgsl: GAP_WGSL },
  { name: 'MISMATCH', wgsl: MISMATCH_WGSL },
  { name: 'INSERTION', wgsl: INSERTION_WGSL },
  { name: 'SOFTCLIP', wgsl: SOFTCLIP_WGSL },
  { name: 'HARDCLIP', wgsl: HARDCLIP_WGSL },
  { name: 'MODIFICATION', wgsl: MODIFICATION_WGSL },
  { name: 'COVERAGE', wgsl: COVERAGE_WGSL },
  { name: 'SNP_COVERAGE', wgsl: SNP_COVERAGE_WGSL },
  { name: 'MOD_COVERAGE', wgsl: MOD_COVERAGE_WGSL },
  { name: 'NONCOV_HISTOGRAM', wgsl: NONCOV_HISTOGRAM_WGSL },
  { name: 'INDICATOR', wgsl: INDICATOR_WGSL },
  { name: 'SEPARATOR_LINE', wgsl: SEPARATOR_LINE_WGSL },
  { name: 'ARC', wgsl: ARC_WGSL },
  { name: 'ARC_LINE', wgsl: ARC_LINE_WGSL },
  { name: 'SASHIMI', wgsl: SASHIMI_WGSL },
  { name: 'CLOUD', wgsl: CLOUD_WGSL },
  { name: 'CONNECTING_LINE', wgsl: CONNECTING_LINE_WGSL },
] as const

const outDir = join(
  import.meta.dirname,
  '..',
  'src',
  'LinearAlignmentsDisplay',
  'components',
  'shaders',
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
  throw new Error(`Unsupported type in SSBO struct: ${type}`)
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

  const stride = fields.length

  let fetchFn = `${structType} _fetch_${structType}(int idx) {\n`
  fetchFn += `    int base = idx * ${stride};\n`
  fetchFn += `    ${structType} s;\n`
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    fetchFn += `    s.${f.name} = ${fetchExpr(f.type, `base + ${i}`)};\n`
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

  const tmpDir = join(tmpdir(), `jbrowse-shader-compile-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  const results: { name: string; vert: string; frag: string }[] = []

  for (const shader of shaders) {
    process.stdout.write(`  ${shader.name}...`)
    const vert = compileShader(
      shader.wgsl,
      'vs_main',
      'vert',
      tmpDir,
      shader.name,
    )
    const frag = compileShader(
      shader.wgsl,
      'fs_main',
      'frag',
      tmpDir,
      shader.name,
    )
    results.push({ name: shader.name, vert, frag })
    process.stdout.write(' ok\n')
  }

  mkdirSync(outDir, { recursive: true })

  let output = '// Auto-generated by compile-shaders.ts from WGSL sources\n'
  output += '// Do not edit manually - edit the WGSL sources in wgsl/ instead\n'
  output += '// Regenerate: pnpm compile-shaders\n\n'

  for (const r of results) {
    output += `export const ${r.name}_VERTEX_SHADER = \`${r.vert.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`\n\n`
    output += `export const ${r.name}_FRAGMENT_SHADER = \`${r.frag.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`\n\n`
  }

  writeFileSync(outFile, output)
  writeFileSync(hashFile, hash)

  rmSync(tmpDir, { recursive: true })

  console.log(
    `compile-shaders: generated ${results.length} shader pairs → ${outFile}`,
  )
}

main()
