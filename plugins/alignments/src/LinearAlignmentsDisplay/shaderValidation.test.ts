import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import {
  GAP_WGSL,
  HARDCLIP_WGSL,
  INSERTION_WGSL,
  MISMATCH_WGSL,
  MODIFICATION_WGSL,
  SOFTCLIP_WGSL,
} from './components/wgsl/cigarShaders.ts'
import {
  COVERAGE_WGSL,
  INDICATOR_WGSL,
  MOD_COVERAGE_WGSL,
  NONCOV_HISTOGRAM_WGSL,
  SNP_COVERAGE_WGSL,
} from './components/wgsl/coverageShaders.ts'
import {
  ARC_LINE_WGSL,
  ARC_WGSL,
  CONNECTING_LINE_WGSL,
  FLAT_QUAD_WGSL,
} from './components/wgsl/miscShaders.ts'
import { READ_WGSL } from './components/wgsl/readShader.ts'

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
  ['read', READ_WGSL],
  ['gap', GAP_WGSL],
  ['mismatch', MISMATCH_WGSL],
  ['insertion', INSERTION_WGSL],
  ['softclip', SOFTCLIP_WGSL],
  ['hardclip', HARDCLIP_WGSL],
  ['modification', MODIFICATION_WGSL],
  ['coverage', COVERAGE_WGSL],
  ['snpCoverage', SNP_COVERAGE_WGSL],
  ['modCoverage', MOD_COVERAGE_WGSL],
  ['noncovHistogram', NONCOV_HISTOGRAM_WGSL],
  ['indicator', INDICATOR_WGSL],
  ['arc', ARC_WGSL],
  ['arcLine', ARC_LINE_WGSL],
  ['connectingLine', CONNECTING_LINE_WGSL],
  ['flatQuad', FLAT_QUAD_WGSL],
]

const skipIfNoNaga = hasNaga() ? describe : describe.skip

skipIfNoNaga('WGSL shader validation (naga)', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'wgsl-validate-'))
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
