import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import {
  ldGenomicShader,
  ldUniformShader,
} from './LDDisplay/components/ldShaders.ts'
import { variantShader } from './MultiVariantDisplay/components/variantShaders.ts'
import { variantMatrixShader } from './MultiVariantMatrixDisplay/components/variantMatrixShaders.ts'

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
    const msg =
      e instanceof Error
        ? ((e as { stderr?: Buffer }).stderr?.toString() ?? e.message)
        : String(e)
    throw new Error(`WGSL validation failed for "${name}":\n${msg}`)
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
