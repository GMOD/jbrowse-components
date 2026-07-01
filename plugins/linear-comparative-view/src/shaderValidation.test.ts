import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { WGSL_SOURCE as edgeCurveShader } from './LinearSyntenyDisplay/shaders/syntenyEdgeCurve.generated.ts'
import { WGSL_SOURCE as edgeStraightShader } from './LinearSyntenyDisplay/shaders/syntenyEdgeStraight.generated.ts'
import { WGSL_SOURCE as fillCurveShader } from './LinearSyntenyDisplay/shaders/syntenyFillCurve.generated.ts'
import { WGSL_SOURCE as fillStraightShader } from './LinearSyntenyDisplay/shaders/syntenyFillStraight.generated.ts'

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
  ['syntenyFillStraight', fillStraightShader],
  ['syntenyFillCurve', fillCurveShader],
  ['syntenyEdgeStraight', edgeStraightShader],
  ['syntenyEdgeCurve', edgeCurveShader],
]

const skipIfNoNaga = hasNaga() ? describe : describe.skip

skipIfNoNaga('WGSL shader validation (naga) — linear-comparative-view', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'wgsl-validate-lcv-'))
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
