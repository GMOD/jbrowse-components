import { execSync } from 'child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import path from 'path'
import os from 'os'

import {
  RECT_SHADER,
  LINE_SHADER,
  CHEVRON_SHADER,
  ARROW_SHADER,
} from './canvasShaders.ts'

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
