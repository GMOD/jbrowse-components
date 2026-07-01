import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  arrowShader,
  chevronShader,
  lineShader,
  rectShader,
} from '../passes/index.ts'

const ARROW_SHADER = arrowShader.WGSL_SOURCE
const CHEVRON_SHADER = chevronShader.WGSL_SOURCE
const LINE_SHADER = lineShader.WGSL_SOURCE
const RECT_SHADER = rectShader.WGSL_SOURCE

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
