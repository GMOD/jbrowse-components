import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { WGSL_SOURCE as ldGenomicShader } from './LDDisplay/components/shaders/ldGenomic.generated.ts'
import { WGSL_SOURCE as ldUniformShader } from './LDDisplay/components/shaders/ldUniform.generated.ts'
import { WGSL_SOURCE as variantShader } from './MultiVariantDisplay/components/shaders/variant.generated.ts'
import { WGSL_SOURCE as variantMatrixShader } from './MultiVariantMatrixDisplay/components/shaders/variantMatrix.generated.ts'

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
  ['variant', variantShader],
  ['variantMatrix', variantMatrixShader],
  ['ld-genomic', ldGenomicShader],
  ['ld-uniform', ldUniformShader],
]

const skipIfNoNaga = hasNaga() ? describe : describe.skip

skipIfNoNaga('WGSL shader validation (naga) — variants', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'wgsl-validate-variants-'))
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
