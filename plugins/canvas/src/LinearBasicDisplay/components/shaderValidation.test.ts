import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { WGSL_SOURCE as ARROW_SHADER } from './shaders/arrow.generated.ts'
import { WGSL_SOURCE as CHEVRON_SHADER } from './shaders/chevron.generated.ts'
import { WGSL_SOURCE as LINE_SHADER } from './shaders/line.generated.ts'
import { WGSL_SOURCE as RECT_SHADER } from './shaders/rect.generated.ts'

let tmpDir: string

function hasNaga() {
  try {
    execSync('naga --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function validateWgsl(name: string, code: string) {
  const file = path.join(tmpDir, `${name}.wgsl`)
  writeFileSync(file, code)
  try {
    execSync(`naga ${file}`, { stdio: 'pipe' })
  } catch (e) {
    throw new Error(`WGSL validation failed for "${name}": ${e}`, { cause: e })
  }
}

const wgslShaders: [string, string][] = [
  ['rect', RECT_SHADER],
  ['line', LINE_SHADER],
  ['chevron', CHEVRON_SHADER],
  ['arrow', ARROW_SHADER],
]

const skipIfNoNaga = hasNaga() ? describe : describe.skip

skipIfNoNaga('WGSL shader validation (naga) — canvas features', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'wgsl-validate-canvas-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  for (const [name, code] of wgslShaders) {
    it(`${name} compiles`, () => {
      validateWgsl(name, code)
    })
  }
})
