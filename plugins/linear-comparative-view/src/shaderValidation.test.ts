import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { WGSL_SOURCE as edgeVertexShader } from './LinearSyntenyDisplay/shaders/syntenyEdge.generated.ts'
import { WGSL_SOURCE as fillVertexShader } from './LinearSyntenyDisplay/shaders/syntenyFill.generated.ts'
import { WGSL_SOURCE as pickingVertexShader } from './LinearSyntenyDisplay/shaders/syntenyPicking.generated.ts'
import {
  WGSL_COVERAGE_SHADER,
  WGSL_FILL_SHADER,
  WGSL_INDICATOR_SHADER,
  WGSL_SNP_COVERAGE_SHADER,
} from './MultiLGVSyntenyDisplay/components/multiSyntenyGpuShaders.ts'

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
  ['syntenyFill', fillVertexShader],
  ['syntenyEdge', edgeVertexShader],
  ['syntenyPicking', pickingVertexShader],
  ['multiSyntenyFill', WGSL_FILL_SHADER],
  ['multiSyntenyCoverage', WGSL_COVERAGE_SHADER],
  ['multiSyntenySnpCoverage', WGSL_SNP_COVERAGE_SHADER],
  ['multiSyntenyIndicator', WGSL_INDICATOR_SHADER],
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
