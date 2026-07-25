import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  GLSL_FRAGMENT,
  GLSL_VERTEX,
  WGSL_SOURCE as hicShader,
} from './shaders/hic.generated.ts'

let tmpDir: string

function hasTool(cmd: string) {
  try {
    execSync(cmd, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function validate(name: string, ext: string, code: string, cmd: string) {
  const file = path.join(tmpDir, `${name}.${ext}`)
  writeFileSync(file, code)
  try {
    execSync(`${cmd} ${file}`, { stdio: 'pipe' })
  } catch (e) {
    throw new Error(
      `${ext.toUpperCase()} validation failed for "${name}": ${e}`,
      { cause: e },
    )
  }
}

const skipIfNoNaga = hasTool('naga --version') ? describe : describe.skip
const skipIfNoGlslang = hasTool('glslangValidator --version')
  ? describe
  : describe.skip

skipIfNoNaga('WGSL shader validation (naga) — hic', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'wgsl-validate-hic-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('hic compiles', () => {
    validate('hic', 'wgsl', hicShader, 'naga')
  })
})

// slangc emits both targets from one .slang, and the WGSL compiling says nothing
// about the GLSL — a construct can be fine in WGSL and rejected by GLSL ES 3.00,
// which would reach only the WebGL2 fallback (i.e. every browser without
// WebGPU) and not until runtime. `.vert`/`.frag` pick the stage for glslangValidator.
skipIfNoGlslang('GLSL ES shader validation (glslangValidator) — hic', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'glsl-validate-hic-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('hic vertex stage compiles', () => {
    validate('hic', 'vert', GLSL_VERTEX, 'glslangValidator')
  })

  it('hic fragment stage compiles', () => {
    validate('hic', 'frag', GLSL_FRAGMENT, 'glslangValidator')
  })
})
