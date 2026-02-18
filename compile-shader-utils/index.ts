import { createHash } from 'crypto'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface StructField {
  type: string
  name: string
}

export interface ShaderDef {
  name: string
  wgsl: string
  entryPoints?: string[]
}

export interface CompileOptions {
  shaders: ShaderDef[]
  outDir: string
  header?: string
}

function hasNaga() {
  try {
    execSync('naga --version', { stdio: 'pipe' })
    return true
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
  for (const line of m[1]!.split(';')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      fields.push({
        type: parts[0]!,
        name: parts[1]!,
      })
    }
  }
  return fields
}

function texel(off: string) {
  return `texelFetch(u_instanceData, ivec2((${off}) / 4, 0), 0)[(${off}) % 4]`
}

function floatTexel(off: string) {
  return `uintBitsToFloat(${texel(off)})`
}

function componentExprs(baseExpr: string, count: number, asFloat: boolean) {
  const fn = asFloat ? floatTexel : texel
  return Array.from({ length: count }, (_, i) =>
    fn(i === 0 ? baseExpr : `${baseExpr} + ${i}`),
  ).join(', ')
}

const SCALAR_TYPES: Record<string, (base: string) => string> = {
  float: base => floatTexel(base),
  uint: base => texel(base),
  int: base => `int(${texel(base)})`,
}

const VECTOR_TYPES: Record<
  string,
  { glsl: string; n: number; float: boolean }
> = {
  vec2: { glsl: 'vec2', n: 2, float: true },
  vec3: { glsl: 'vec3', n: 3, float: true },
  vec4: { glsl: 'vec4', n: 4, float: true },
  ivec2: { glsl: 'ivec2', n: 2, float: false },
  ivec3: { glsl: 'ivec3', n: 3, float: false },
  ivec4: { glsl: 'ivec4', n: 4, float: false },
  uvec2: { glsl: 'uvec2', n: 2, float: false },
  uvec3: { glsl: 'uvec3', n: 3, float: false },
  uvec4: { glsl: 'uvec4', n: 4, float: false },
}

function fetchExpr(type: string, baseExpr: string) {
  const scalar = SCALAR_TYPES[type]
  if (scalar) {
    return scalar(baseExpr)
  }
  const vec = VECTOR_TYPES[type]
  if (vec) {
    return `${vec.glsl}(${componentExprs(baseExpr, vec.n, vec.float)})`
  }
  throw new Error(`Unsupported type in SSBO struct: ${type}`)
}

function fieldSize(type: string) {
  return VECTOR_TYPES[type]?.n ?? 1
}

function replaceSSBO(glsl: string) {
  const ssboRe =
    /layout\(std430\)\s+readonly\s+buffer\s+\w+\s*\{\s*(\w+)\s+(\w+)\[\]\s*;\s*\}\s*;/
  const ssboMatch = ssboRe.exec(glsl)
  if (!ssboMatch) {
    return glsl
  }

  const structType = ssboMatch[1]!
  const arrayName = ssboMatch[2]!
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
    const f = fields[i]!
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

function compileEntry(
  wgsl: string,
  entryPoint: string,
  tmpDir: string,
  name: string,
) {
  const stage = entryPoint.startsWith('vs_') ? 'vert' : 'frag'
  const wgslPath = join(tmpDir, `${name}.wgsl`)
  const outPath = join(tmpDir, `${name}_${entryPoint}.${stage}`)
  writeFileSync(wgslPath, wgsl)
  try {
    execSync(
      `naga "${wgslPath}" "${outPath}" --entry-point ${entryPoint} --keep-coordinate-space --compact`,
      { stdio: 'pipe' },
    )
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer }
    console.error(`naga failed for ${name} ${entryPoint}:`)
    console.error(err.stderr?.toString())
    throw e
  }
  return postProcess(readFileSync(outPath, 'utf-8'))
}

function exportName(shaderName: string, entryPoint: string) {
  if (entryPoint === 'vs_main') {
    return `${shaderName}_VERTEX_SHADER`
  }
  if (entryPoint === 'fs_main') {
    return `${shaderName}_FRAGMENT_SHADER`
  }
  const suffix = entryPoint
    .replace('vs_', 'VERTEX_SHADER_')
    .replace('fs_', 'FRAGMENT_SHADER_')
    .toUpperCase()
  return `${shaderName}_${suffix}`
}

function escape(s: string) {
  return s.replace(/`/g, '\\`').replace(/\$/g, '\\$')
}

export function compileShaders(opts: CompileOptions) {
  const { shaders, outDir } = opts
  const outFile = join(outDir, 'index.ts')
  const hashFile = join(outDir, '.wgsl-hash')

  const allWgsl = shaders.map(s => s.wgsl).join('\n')
  const hash = createHash('sha256').update(allWgsl).digest('hex')

  if (existsSync(outFile) && existsSync(hashFile)) {
    try {
      if (readFileSync(hashFile, 'utf-8').trim() === hash) {
        console.log('compile-shaders: GLSL is up to date, skipping')
        return
      }
    } catch {}
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

  const results: { exportName: string; glsl: string }[] = []
  for (const shader of shaders) {
    const entries = shader.entryPoints ?? ['vs_main', 'fs_main']
    process.stdout.write(`  ${shader.name}...`)
    for (const ep of entries) {
      const glsl = compileEntry(shader.wgsl, ep, tmpDir, shader.name)
      results.push({ exportName: exportName(shader.name, ep), glsl })
    }
    process.stdout.write(' ok\n')
  }

  mkdirSync(outDir, { recursive: true })

  let output = '// Auto-generated by compile-shaders.ts from WGSL sources\n'
  if (opts.header) {
    output += `// ${opts.header}\n`
  }
  output += '// Regenerate: pnpm compile-shaders\n\n'

  for (const r of results) {
    output += `export const ${r.exportName} = \`${escape(r.glsl)}\`\n\n`
  }

  writeFileSync(outFile, output)
  writeFileSync(hashFile, hash)
  rmSync(tmpDir, { recursive: true })
  console.log(
    `compile-shaders: generated ${results.length} shaders → ${outFile}`,
  )
}
